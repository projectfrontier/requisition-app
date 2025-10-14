// app.js
// Load in index.html with: <script type="module" src="app.js"></script>

// ---- SET THESE ----
const SUPABASE_URL = "https://jlzbxqhvegqcvyhqnkrq.supabase.co";   // public
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsemJ4cWh2ZWdxY3Z5aHFua3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDQ0MDMsImV4cCI6MjA3NTgyMDQwM30.GU5mpLfbuF0o7W1KNRUV5zSBAqagCYwjTTg0xD1WCnc";            // public anon key
// -------------------

const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Build function URL from supabase URL
const fnBase = SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co");
const AI_GENERATOR_URL = `${fnBase}/ai-generator`;
console.log("AI_GENERATOR_URL:", AI_GENERATOR_URL);

// small helpers
const $ = (id) => document.getElementById(id);
function showMessage(text, isError = false) {
  let el = $("formStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "formStatus";
    el.style.marginTop = "10px";
    el.style.fontWeight = "600";
    $("requisitionForm").appendChild(el);
  }
  el.style.color = isError ? "#ff6b6b" : "#e0f780";
  el.textContent = text;
}
function setSubmitting(isSubmitting) {
  const btn = $("submitFormBtn");
  if (!btn) return;
  btn.disabled = isSubmitting;
  btn.textContent = isSubmitting ? "Submitting..." : "Submit";
}

// Wire the Generate JD button to the Edge Function
function wireGenerateJD() {
  const btn = $("generateJdBtn");
  if (!btn) {
    console.warn("generateJdBtn not found in DOM");
    return;
  }

  const spinner = btn.querySelector(".spinner");
  const keywordsInput = $("jdKeywords");
  const jdTextarea = $("jobDescriptions");
  const status = $("jdStatusMessage");

  btn.addEventListener("click", async () => {
    console.log("Generate JD button clicked");
    const keywords = (keywordsInput?.value || "").trim();
    if (!keywords) {
      status.textContent = "Enter keywords first (comma-separated).";
      return;
    }

    if (spinner) spinner.style.display = "inline-block";
    btn.disabled = true;
    status.textContent = "Generating...";

    try {
      const resp = await fetch(AI_GENERATOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error("ai-generator error:", resp.status, json);
        status.textContent = json?.error || `Generator failed (${resp.status}).`;
        return;
      }

      jdTextarea.value = json.generated_jd || "(no text returned)";
      status.textContent = "Generated. You can edit before submitting.";
      console.log("generator success", json);
    } catch (e) {
      console.error("generator fetch failed", e);
      status.textContent = "Could not generate JD. Please try again.";
    } finally {
      if (spinner) spinner.style.display = "none";
      btn.disabled = false;
    }
  });
}

// serialize + submit to Supabase (unchanged from earlier)
function serializeForm() {
  return {
    requester_name: $("requesterName").value.trim(),
    requester_email: $("requesterEmail").value.trim(),
    department: $("department").value || null,
    position_external_title: $("positionExternalTitle").value.trim(),
    position_career_level: $("positionCareerLevel").value || null,
    about_the_role: $("aboutTheRole").value.trim() || null,
    job_descriptions: $("jobDescriptions").value.trim(),
    job_requirements: $("jobRequirements").value.trim() || null,
    position_reporting_to: $("positionReportingTo").value.trim() || null,
    budget_salary: $("budgetSalary").value ? Number($("budgetSalary").value) : null,
    requisition_type: $("requisitionType").value || null,
    name_to_be_replaced: $("nameToBeReplaced").value.trim() || null,
    reason_of_requisition: $("reasonOfRequisition").value.trim() || null,
    onboarding_corporate_card: $("onboardingCorporateCard")?.checked || false,
    onboarding_business_card: $("onboardingBusinessCard")?.checked || false,
    onboarding_others: $("onboardingOthers")?.checked || false,
    onboarding_not_required: $("onboardingNotRequired")?.checked || false,
    other_requirements: $("otherRequirements").value.trim() || null,
    additional_comments: $("additionalComments").value.trim() || null,
    requested_date: $("requestedDate").value || null,
  };
}

document.addEventListener("DOMContentLoaded", () => {
  wireGenerateJD();

  const form = $("requisitionForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showMessage("");
      setSubmitting(true);

      if (!form.checkValidity()) {
        setSubmitting(false);
        showMessage("Please fill all required fields.", true);
        return;
      }

      try {
        const payload = serializeForm();
        const { data, error } = await supabase
          .from("requisitions")
          .insert(payload)
          .select("id, position_external_title")
          .single();

        if (error) throw error;
        const ref = data?.id || "(no id)";
        showMessage(`Submitted. Reference ID: ${ref}`);
        form.reset();
      } catch (err) {
        console.error(err);
        showMessage("There was an error saving your request. Please try again.", true);
      } finally {
        setSubmitting(false);
      }
    });
  } else {
    console.warn("requisitionForm not found in DOM");
  }
});

// --- START: wiring bootstrap (append to end of app.js) ---
/*
  Robust bootstrap for wireGenerateJD.
  Purpose:
    - expose window.wireGenerateJD for console debugging
    - attempt to call wireGenerateJD without allowing earlier errors
      to stop the rest of the module from wiring the button
*/

(function bootstrapWireGenerateJD() {
  try {
    // If the function exists in the module, expose it for debugging
    if (typeof wireGenerateJD === "function") {
      window.wireGenerateJD = wireGenerateJD;
      console.log("wireGenerateJD() found and exposed on window");
    } else {
      console.warn("wireGenerateJD() not found at bootstrap time");
    }

    // Attempt to call it immediately but guard against errors
    const safeCall = () => {
      try {
        if (typeof wireGenerateJD === "function") {
          wireGenerateJD();
          console.log("wireGenerateJD() executed (bootstrap)");
        } else {
          // If not defined, try again later when DOM content loaded
          document.addEventListener("DOMContentLoaded", () => {
            try {
              if (typeof wireGenerateJD === "function") {
                wireGenerateJD();
                console.log("wireGenerateJD() executed on DOMContentLoaded");
              } else {
                console.warn("wireGenerateJD() still not available");
              }
            } catch (err) {
              console.error("wireGenerateJD() error on DOMContentLoaded:", err);
            }
          });
        }
      } catch (err) {
        console.error("wireGenerateJD() bootstrap call failed:", err);
      }
    };

    // If DOM already ready, call now; otherwise wait short time and then try
    if (document.readyState === "complete" || document.readyState === "interactive") {
      safeCall();
    } else {
      document.addEventListener("DOMContentLoaded", safeCall);
      // also set a safety retry in 1 second
      setTimeout(safeCall, 1000);
    }
  } catch (err) {
    console.error("bootstrapWireGenerateJD top-level error:", err);
  }
})();
 // --- END: wiring bootstrap ---

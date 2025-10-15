// public/app.js
// Load in index.html with: <script type="module" src="app.js"></script>

(async function initApp() {
  try {
    // ---- CONFIG ----
    const SUPABASE_URL = "https://jlzbxqhvegqcvyhqnkrq.supabase.co"; // public
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsemJ4cWh2ZWdxY3Z5aHFua3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDQ0MDMsImV4cCI6MjA3NTgyMDQwM30.GU5mpLfbuF0o7W1KNRUV5zSBAqagCYwjTTg0xD1WCnc"; // public anon key
    // -----------------

    // dynamic import (no top-level await errors in non-module environments)
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // expose for debugging
    window.__supabase = supabase;
    console.log("supabase client created and exposed as window.__supabase.");

    // build function URL
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
        const frm = $("requisitionForm");
        if (frm) frm.appendChild(el);
      }
      if (!el) return;
      el.style.color = isError ? "#ff6b6b" : "#e0f780";
      el.textContent = text;
    }
    function setSubmitting(isSubmitting) {
      const btn = $("submitFormBtn");
      if (!btn) return;
      btn.disabled = isSubmitting;
      btn.textContent = isSubmitting ? "Submitting..." : "Submit";
    }

    // Generate JD wiring
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

      // safety checks
      if (!status) {
        console.warn("jdStatusMessage not present; create an element with id='jdStatusMessage' for status");
      }

      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        console.log("Generate JD button clicked");
        const keywords = (keywordsInput?.value || "").trim();
        if (!keywords) {
          if (status) status.textContent = "Enter keywords first (comma-separated).";
          return;
        }

        if (spinner) spinner.style.display = "inline-block";
        btn.disabled = true;
        if (status) status.textContent = "Generating...";

        try {
          const resp = await fetch(AI_GENERATOR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keywords }),
          });

          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            console.error("ai-generator error:", resp.status, json);
            if (status) status.textContent = json?.error || `Generator failed (${resp.status}).`;
            return;
          }

          if (jdTextarea) jdTextarea.value = json.generated_jd || "(no text returned)";
          if (status) status.textContent = "Generated. You can edit before submitting.";
          console.log("generator success", json);
        } catch (err) {
          console.error("generator fetch failed", err);
          if (status) status.textContent = "Could not generate JD. Please try again.";
        } finally {
          if (spinner) spinner.style.display = "none";
          btn.disabled = false;
        }
      });
      console.log("wireGenerateJD bound.");
    }

    // serialize form (defensive - guards missing elements)
    function valueOrNull(id) {
      const el = $(id);
      if (!el) return null;
      return (el.value || "").toString().trim() || null;
    }
    function serializeForm() {
      return {
        requester_name: valueOrNull("requesterName") || "",
        requester_email: valueOrNull("requesterEmail") || "",
        department: valueOrNull("department"),
        position_external_title: valueOrNull("positionExternalTitle") || "",
        position_career_level: valueOrNull("positionCareerLevel"),
        about_the_role: valueOrNull("aboutTheRole"),
        job_descriptions: valueOrNull("jobDescriptions") || "",
        job_requirements: valueOrNull("jobRequirements"),
        position_reporting_to: valueOrNull("positionReportingTo"),
        budget_salary: (() => {
          const v = valueOrNull("budgetSalary");
          return v ? Number(v) : null;
        })(),
        requisition_type: valueOrNull("requisitionType"),
        name_to_be_replaced: valueOrNull("nameToBeReplaced"),
        reason_of_requisition: valueOrNull("reasonOfRequisition"),
        onboarding_corporate_card: $("onboardingCorporateCard")?.checked || false,
        onboarding_business_card: $("onboardingBusinessCard")?.checked || false,
        onboarding_others: $("onboardingOthers")?.checked || false,
        onboarding_not_required: $("onboardingNotRequired")?.checked || false,
        other_requirements: valueOrNull("otherRequirements"),
        additional_comments: valueOrNull("additionalComments"),
        requested_date: valueOrNull("requestedDate"),
      };
    }

    // Robust delegated submit handler (single listener on document)
    function wireFormSubmit() {
      // ensure generate JD wired too
      wireGenerateJD();

      // Log for debugging
      console.log("Robust delegated submit handler initializing...");

      // Single delegated listener (catches the form submit reliably even if the element was re-rendered)
      document.addEventListener(
        "submit",
        async (e) => {
          // only handle our form
          const target = e.target;
          if (!target || target.id !== "requisitionForm") return;

          e.preventDefault();
          console.log("form submit handler fired - default prevented:", e.defaultPrevented);
          showMessage("");
          setSubmitting(true);

          try {
            // HTML5 validity check
            if (!target.checkValidity()) {
              setSubmitting(false);
              showMessage("Please fill all required fields.", true);
              console.warn("form failed HTML5 validation");
              return;
            }

            const payload = serializeForm();
            console.log("submitting payload:", payload);

            const { data, error } = await supabase
              .from("requisitions")
              .insert(payload)
              .select("id, position_external_title")
              .single();

            if (error) {
              console.error("submit error:", error);
              // Specific handling for common RLS error from PostgREST
              if (error?.code === "42501" || /row-level security/i.test(error?.message || "")) {
                showMessage("Insert blocked by row-level security (see Supabase table policies).", true);
                // give actionable guidance in console
                console.error("Row-level security prevents anonymous inserts. Run the SQL policy change in Supabase console (see instructions).");
              } else {
                showMessage("There was an error saving your request. Please try again.", true);
              }
              return;
            }

            const ref = data?.id || "(no id)";
            showMessage(`Submitted. Reference ID: ${ref}`);
            target.reset();
            console.log("submit success:", data);
          } catch (err) {
            console.error("unexpected submit error:", err);
            showMessage("There was an error saving your request. Please try again.", true);
          } finally {
            setSubmitting(false);
          }
        },
        { capture: false }
      );

      console.log("Robust delegated submit handler wired (document-level).");
    }

    // Boot wiring when DOM ready (safest)
    const boot = () => {
      try {
        wireFormSubmit();
        console.log("form submit wired.");
      } catch (err) {
        console.error("error wiring form submit:", err);
      }
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
      boot();
    } else {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
      // fallback retry
      setTimeout(boot, 1000);
    }

    // expose wireGenerateJD for manual debugging
    window.wireGenerateJD = wireGenerateJD;
    console.log("wireGenerateJD bound.");
  } catch (err) {
    console.error("app.js boot error:", err);
  }
})();
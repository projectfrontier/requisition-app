// app.js (full drop-in)
// Load in index.html with: <script type="module" src="app.js"></script>

// ---- CONFIG (set these in your file) ----
const SUPABASE_URL = "https://jlzbxqhvegqcvyhqnkrq.supabase.co";   // public
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsemJ4cWh2ZWdxY3Z5aHFua3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDQ0MDMsImV4cCI6MjA3NTgyMDQwM30.GU5mpLfbuF0o7W1KNRUV5zSBAqagCYwjTTg0xD1WCnc";
// -----------------------------------------

// import supabase client (ES module from CDN)
const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Build function URL from supabase URL
const fnBase = SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co");
const AI_GENERATOR_URL = `${fnBase}/ai-generator`;
console.log("AI_GENERATOR_URL:", AI_GENERATOR_URL);

// Small helpers
const $ = (id) => document.getElementById(id);
const safeText = (v) => (typeof v === "string" ? v.trim() : (v == null ? "" : String(v)));
function debug(...args) { console.debug(...args); }

function showMessage(text, isError = false) {
  let el = $("formStatus");
  const form = $("requisitionForm");
  if (!form) return console.warn("showMessage: form not found");
  if (!el) {
    el = document.createElement("div");
    el.id = "formStatus";
    el.style.marginTop = "10px";
    el.style.fontWeight = "600";
    form.appendChild(el);
  }
  el.style.color = isError ? "#ff6b6b" : "#e0f780";
  el.textContent = text;
}

function setSubmitting(isSubmitting) {
  const btn = $("submitFormBtn");
  if (!btn) return;
  btn.disabled = isSubmitting;
  btn.textContent = isSubmitting ? "Submitting..." : "Submit";
  // add aria-busy for accessibility
  btn.setAttribute("aria-busy", isSubmitting ? "true" : "false");
}

// ----- Generate JD wiring (Edge function) -----
function wireGenerateJD() {
  const btn = $("generateJdBtn");
  if (!btn) {
    console.warn("wireGenerateJD: generateJdBtn not found");
    return;
  }

  const spinner = btn.querySelector(".spinner");
  const keywordsInput = $("jdKeywords");
  const jdTextarea = $("jobDescriptions");
  const status = $("jdStatusMessage");

  // ensure status element exists
  if (!status && btn.parentElement) {
    const s = document.createElement("div");
    s.id = "jdStatusMessage";
    s.style.marginTop = "8px";
    btn.parentElement.appendChild(s);
  }

  btn.addEventListener("click", async (ev) => {
    ev?.preventDefault?.();
    debug("Generate JD button clicked");
    const keywords = (keywordsInput?.value || "").trim();
    if (!keywords) {
      ($("jdStatusMessage") || {}).textContent = "Enter keywords first (comma-separated).";
      return;
    }

    if (spinner) spinner.style.display = "inline-block";
    btn.disabled = true;
    ($("jdStatusMessage") || {}).textContent = "Generating...";

    try {
      const resp = await fetch(AI_GENERATOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error("ai-generator error:", resp.status, json);
        ($("jdStatusMessage") || {}).textContent = json?.error || `Generator failed (${resp.status}).`;
        return;
      }

      if (jdTextarea) jdTextarea.value = json.generated_jd || "(no text returned)";
      ($("jdStatusMessage") || {}).textContent = "Generated. You can edit before submitting.";
      console.log("generator success", json);
    } catch (e) {
      console.error("generator fetch failed", e);
      ($("jdStatusMessage") || {}).textContent = "Could not generate JD. Please try again.";
    } finally {
      if (spinner) spinner.style.display = "none";
      btn.disabled = false;
    }
  });

  console.log("wireGenerateJD bound.");
}

// ----- serialize form (defensive) -----
function serializeForm() {
  const get = (id) => document.getElementById(id);
  const val = (id) => safeText(get(id)?.value || "");
  const chk = (id) => !!get(id)?.checked;
  const num = (id) => {
    const v = safeText(get(id)?.value || "");
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    requester_name: val("requesterName") || null,
    requester_email: val("requesterEmail") || null,
    department: val("department") || null,
    position_external_title: val("positionExternalTitle") || null,
    position_career_level: val("positionCareerLevel") || null,
    about_the_role: val("aboutTheRole") || null,
    job_descriptions: val("jobDescriptions") || null,
    job_requirements: val("jobRequirements") || null,
    position_reporting_to: val("positionReportingTo") || null,
    budget_salary: num("budgetSalary"),
    requisition_type: val("requisitionType") || null,
    name_to_be_replaced: val("nameToBeReplaced") || null,
    reason_of_requisition: val("reasonOfRequisition") || null,
    onboarding_corporate_card: chk("onboardingCorporateCard"),
    onboarding_business_card: chk("onboardingBusinessCard"),
    onboarding_others: chk("onboardingOthers"),
    onboarding_not_required: chk("onboardingNotRequired"),
    other_requirements: val("otherRequirements") || null,
    additional_comments: val("additionalComments") || null,
    requested_date: val("requestedDate") || null,
  };
}

// ----- main submit handler (shared) -----
async function submitHandler(e) {
  try {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    // Clear messages
    showMessage("");
    setSubmitting(true);

    const form = $("requisitionForm");
    // If form exists, validate first (HTML5)
    if (form && !form.checkValidity()) {
      setSubmitting(false);
      showMessage("Please fill all required fields.", true);
      // If there is a required field the browser will normally show its tooltip;
      // find the first invalid element and call reportValidity if supported.
      const firstInvalid = form.querySelector(":invalid");
      if (firstInvalid && typeof firstInvalid.reportValidity === "function") {
        firstInvalid.reportValidity();
      }
      return;
    }

    const payload = serializeForm();
    console.log("Submitting payload to Supabase:", payload);

    const { data, error } = await supabase
      .from("requisitions")
      .insert(payload)
      .select("id, position_external_title")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }

    const ref = data?.id || "(no id)";
    showMessage(`Submitted. Reference ID: ${ref}`);
    // Reset form if successful
    const formEl = $("requisitionForm");
    if (formEl) formEl.reset();
    console.log("Submission successful", data);
  } catch (err) {
    console.error("Submit handler error:", err);
    const msg = err?.message || "There was an error saving your request. Please try again.";
    showMessage(msg, true);
  } finally {
    setSubmitting(false);
  }
}

// ----- bootstrapping wiring -----
// Call this once DOM is ready
function wireFormAndButtons() {
  try {
    // wire generate JD
    wireGenerateJD();

    // robustly wire form submit:
    const form = $("requisitionForm");
    const submitBtn = $("submitFormBtn");

    // If there is a submit button, force it to type="button" to avoid native submit race.
    if (submitBtn) {
      try {
        submitBtn.type = "button";
        // click handler -> call our submit handler
        submitBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          // small safety: disable double click quickly
          submitBtn.disabled = true;
          setTimeout(() => (submitBtn.disabled = false), 750);
          submitHandler();
        });
        console.log("submit button forced to type=button and wired (click).");
      } catch (err) {
        console.warn("Could not retype submit button (continuing):", err);
      }
    }

    // Add a fallback capture-phase submit listener on the form (handles Enter/key submits)
    if (form) {
      // Remove any previous listener we installed to prevent duplicates (safe)
      if (form.__ourSubmitListener) {
        form.removeEventListener("submit", form.__ourSubmitListener, { capture: true });
      }
      const onSubmit = (ev) => {
        ev.preventDefault();
        console.log("FORM submit event fired (captured)");
        submitHandler(ev);
      };
      form.addEventListener("submit", onSubmit, { capture: true });
      form.__ourSubmitListener = onSubmit;
      console.log("form submit listener installed (capture)");
    } else {
      console.warn("requisitionForm not found in DOM during wiring");
    }

  } catch (err) {
    console.error("wireFormAndButtons error:", err);
  }
}

// Run wiring when DOM ready. Also expose functions to window for debugging.
(function bootstrap() {
  try {
    window.wireGenerateJD = wireGenerateJD;
    window.submitHandler = submitHandler;
    window.wireFormAndButtons = wireFormAndButtons;
    // If DOM ready now call immediately
    if (document.readyState === "interactive" || document.readyState === "complete") {
      wireFormAndButtons();
    } else {
      document.addEventListener("DOMContentLoaded", wireFormAndButtons);
      // safety retry in case of odd loads
      setTimeout(wireFormAndButtons, 1200);
    }
    console.log("app.js bootstrapped: wireFormAndButtons scheduled");
  } catch (err) {
    console.error("app.js bootstrap failed:", err);
  }
})();

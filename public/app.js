// app.js (drop-in replacement)
// Safe async bootstrap (no top-level await required)

(function () {
  "use strict";

  // ---- CONFIG (replace if needed) ----
  const SUPABASE_URL = "https://jlzbxqhvegqcvyhqnkrq.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsemJ4cWh2ZWdxY3Z5aHFua3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDQ0MDMsImV4cCI6MjA3NTgyMDQwM30.GU5mpLfbuF0o7W1KNRUV5zSBAqagCYwjTTg0xD1WCnc";
  // -------------------------------------

  // Build function URL from supabase URL
  const fnBase = SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co");
  const AI_GENERATOR_URL = `${fnBase}/ai-generator`;
  console.log("AI_GENERATOR_URL:", AI_GENERATOR_URL);

  // small helpers scoped to this module
  const $ = (id) => document.getElementById(id);

  function showMessage(text, isError = false) {
    let el = $("formStatus");
    // create a status area under form if missing
    if (!el) {
      const form = $("requisitionForm");
      if (!form) {
        console.warn("showMessage: requisitionForm not found");
        return;
      }
      el = document.createElement("div");
      el.id = "formStatus";
      el.style.marginTop = "10px";
      el.style.fontWeight = "600";
      form.appendChild(el);
    }
    el.style.color = isError ? "#ff6b6b" : "#e0f780";
    el.textContent = text || "";
  }

  function setSubmitting(isSubmitting) {
    const btn = $("submitFormBtn");
    if (!btn) return;
    btn.disabled = isSubmitting;
    btn.textContent = isSubmitting ? "Submitting..." : "Submit";
  }

  // wire Generate JD button to the Edge Function
  function wireGenerateJD(supabaseClient) {
    try {
      const btn = $("generateJdBtn");
      if (!btn) {
        console.warn("wireGenerateJD: generateJdBtn not found in DOM");
        return;
      }
      // prevent double-binding
      if (btn.__wiredForJD) return;
      btn.__wiredForJD = true;

      const spinner = btn.querySelector(".spinner");
      const keywordsInput = $("jdKeywords");
      const jdTextarea = $("jobDescriptions");
      const status = $("jdStatusMessage") || (function () {
        // fallback create small status under JD input
        const el = document.createElement("div");
        el.id = "jdStatusMessage";
        el.style.marginTop = "6px";
        el.style.opacity = "0.95";
        if ($("jobDescriptions")) $("jobDescriptions").parentNode.insertBefore(el, $("jobDescriptions").nextSibling);
        return el;
      })();

      btn.addEventListener("click", async (evt) => {
        evt && evt.preventDefault && evt.preventDefault();
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

          // attempt to parse json safely
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
      console.log("wireGenerateJD bound.");
    } catch (err) {
      console.error("wireGenerateJD top-level error:", err);
    }
  }

  // serialize form to payload
  function serializeForm() {
    const get = (id) => ($(`#${id}`) ? $(`#${id}`).value : "");
    // safe accessors for checkboxes
    const chk = (id) => !!document.querySelector(`#${id}`) && document.querySelector(`#${id}`).checked;

    return {
      requester_name: (get("requesterName") || "").trim(),
      requester_email: (get("requesterEmail") || "").trim(),
      department: get("department") || null,
      position_external_title: (get("positionExternalTitle") || "").trim(),
      position_career_level: get("positionCareerLevel") || null,
      about_the_role: (get("aboutTheRole") || "").trim() || null,
      job_descriptions: (get("jobDescriptions") || "").trim(),
      job_requirements: (get("jobRequirements") || "").trim() || null,
      position_reporting_to: (get("positionReportingTo") || "").trim() || null,
      budget_salary: get("budgetSalary") ? Number(get("budgetSalary")) : null,
      requisition_type: get("requisitionType") || null,
      name_to_be_replaced: (get("nameToBeReplaced") || "").trim() || null,
      reason_of_requisition: (get("reasonOfRequisition") || "").trim() || null,
      onboarding_corporate_card: chk("onboardingCorporateCard") || false,
      onboarding_business_card: chk("onboardingBusinessCard") || false,
      onboarding_others: chk("onboardingOthers") || false,
      onboarding_not_required: chk("onboardingNotRequired") || false,
      other_requirements: (get("otherRequirements") || "").trim() || null,
      additional_comments: (get("additionalComments") || "").trim() || null,
      requested_date: get("requestedDate") || null,
    };
  }

  // attach submit handler to the form
  function wireFormSubmit(supabaseClient) {
    try {
      const form = $("requisitionForm");
      if (!form) {
        console.warn("wireFormSubmit: requisitionForm not found");
        return;
      }
      if (form.__wiredForSubmit) return;
      form.__wiredForSubmit = true;

      form.addEventListener(
        "submit",
        async (e) => {
          e.preventDefault();
          console.log("form submit handler fired - default prevented:", e.defaultPrevented);
          showMessage("");
          setSubmitting(true);

          // browser constraint validation prevents submit event when invalid;
          // form.checkValidity() here is just a second guard
          if (!form.checkValidity()) {
            setSubmitting(false);
            showMessage("Please fill all required fields.", true);
            return;
          }

          try {
            const payload = serializeForm();
            console.log("submitting payload:", payload);

            const { data, error } = await supabaseClient
              .from("requisitions")
              .insert(payload)
              .select("id, position_external_title")
              .single();

            if (error) throw error;
            const ref = data?.id || "(no id)";
            showMessage(`Submitted. Reference ID: ${ref}`);
            form.reset();
          } catch (err) {
            console.error("submit error:", err);
            showMessage("There was an error saving your request. Please try again.", true);
          } finally {
            setSubmitting(false);
          }
        },
        { once: false }
      );

      console.log("form submit wired.");
    } catch (err) {
      console.error("wireFormSubmit error:", err);
    }
  }

  // main async boot — imports supabase client then wires everything
  (async function boot() {
    try {
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      const createClient = mod.createClient;
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.__supabase = supabase; // expose for console debugging if needed
      console.log("supabase client created and exposed as window.__supabase");

      // Wait until DOM ready, then wire UI
      const whenReady = () =>
        new Promise((resolve) => {
          if (document.readyState === "complete" || document.readyState === "interactive") {
            return resolve();
          }
          document.addEventListener("DOMContentLoaded", resolve, { once: true });
          // safety fallback
          setTimeout(resolve, 1000);
        });

      await whenReady();

      // wire generate JD and form submit
      wireGenerateJD(supabase);
      wireFormSubmit(supabase);

      // expose to console for manual debugging
      window.wireGenerateJD = () => wireGenerateJD(supabase);
      window.wireFormSubmit = () => wireFormSubmit(supabase);

      console.log("app.js: boot completed — UI wired.");
    } catch (err) {
      console.error("app.js boot error:", err);
    }
  })();
})();

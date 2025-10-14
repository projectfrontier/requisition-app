// ====================================================================
// CONFIGURATION: REPLACE THESE PLACEHOLDERS
// ====================================================================

// NOTE: We will update this URL later after the Edge Function is deployed.
// For now, use a placeholder.
const AI_FUNCTION_URL = "https://jlzbxqhvegqcvyhqnkrq.supabase.co/functions/v1/ai-generator"; 

// NOTE: We will update this value later after the Edge Function is deployed.
// This is your Supabase Anon Public Key (from Settings -> API)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsemJ4cWh2ZWdxY3Z5aHFua3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNDQ0MDMsImV4cCI6MjA3NTgyMDQwM30.GU5mpLfbuF0o7W1KNRUV5zSBAqagCYwjTTg0xD1WCnc"; 

// ====================================================================
// DOM Elements and Event Listeners
// ====================================================================

const form = document.getElementById('requisitionForm');
const jdKeywordsInput = document.getElementById('jdKeywords');
const jobDescriptionsTextarea = document.getElementById('jobDescriptions');
const generateJdBtn = document.getElementById('generateJdBtn');
const regenerateJdBtn = document.getElementById('regenerateJdBtn');
const editJdBtn = document.getElementById('editJdBtn');
const jdStatusMessage = document.getElementById('jdStatusMessage');
// 🚨 NEW: Added element for Other Requirements text field
const otherRequirementsInput = document.getElementById('otherRequirements'); 
// 🚨 NEW: Added element for Name to be Replaced field (related to Requisition Type)
const nameToBeReplacedInput = document.getElementById('nameToBeReplaced'); 


let isTextEditable = false;

// --- Utility Functions ---

function toggleLoading(isLoading) {
    const spinner = generateJdBtn.querySelector('.spinner');
    generateJdBtn.disabled = isLoading;
    jdKeywordsInput.disabled = isLoading;
    spinner.style.display = isLoading ? 'inline-block' : 'none';
    generateJdBtn.textContent = isLoading ? 'Generating...' : 'Generate JD';
    if (!isLoading) {
        // Restore original text after stopping loading, replacing the 'Generating...' text
        generateJdBtn.innerHTML = `Generate JD <span class="spinner" style="display:none;"></span>`;
    }
}

function updateJdActions(hasText) {
    regenerateJdBtn.disabled = !hasText;
    editJdBtn.disabled = !hasText;
    jobDescriptionsTextarea.readOnly = !isTextEditable;
    
    // Update button text based on current state
    if (hasText && isTextEditable) {
        editJdBtn.textContent = 'Editing Mode (Click to Lock)';
        jobDescriptionsTextarea.focus();
    } else if (hasText && !isTextEditable) {
        editJdBtn.textContent = 'Accept & Edit';
    } else {
        editJdBtn.textContent = 'Accept & Edit';
    }
}

// --- AI Generation Handlers ---

async function generateJobDescription(keywords, mode = 'initial') {
    if (!keywords.trim()) {
        jdStatusMessage.textContent = "Please enter some keywords to generate the Job Description.";
        jdStatusMessage.style.color = 'var(--error-color)';
        return;
    }

    toggleLoading(true);
    jdStatusMessage.textContent = "Request sent to AI. Generating...";
    jdStatusMessage.style.color = 'var(--secondary-color)';
    isTextEditable = false;
    updateJdActions(false);
    jobDescriptionsTextarea.readOnly = true;

    try {
        const response = await fetch(AI_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Supabase Edge Functions require an Authorization header for CORS/security
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                keywords: keywords.trim(),
                // Include the current JD text if we are in 'regenerate' mode
                current_jd: mode === 'regenerate' ? jobDescriptionsTextarea.value : '' 
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        jobDescriptionsTextarea.value = data.generated_jd || "Could not generate Job Description. Please try again with different keywords.";
        jdStatusMessage.textContent = "Job Description successfully generated.";
        jdStatusMessage.style.color = 'var(--primary-color)';
        updateJdActions(true);

    } catch (error) {
        console.error('Error generating JD:', error);
        jdStatusMessage.textContent = `Error: ${error.message}. Check console for details.`;
        jdStatusMessage.style.color = 'var(--error-color)';
        jobDescriptionsTextarea.value = ''; // Clear on error
    } finally {
        toggleLoading(false);
    }
}

// --- Event Listeners ---

generateJdBtn.addEventListener('click', () => {
    generateJobDescription(jdKeywordsInput.value, 'initial');
});

regenerateJdBtn.addEventListener('click', () => {
    // Re-run the generation with the same keywords, but tell the AI to try again
    generateJobDescription(jdKeywordsInput.value, 'regenerate');
});

editJdBtn.addEventListener('click', () => {
    // Toggle the editing mode for the textarea
    isTextEditable = !isTextEditable;
    updateJdActions(true);
});


// --- Final Form Submission Handler ---

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Basic validation check for the AI field
    if (!jobDescriptionsTextarea.value.trim()) {
        alert("Please generate or manually enter the Job Description before submitting.");
        return;
    }

    const submitBtn = document.getElementById('submitFormBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // 1. Gather all form data
    const formData = new FormData(form);
    
    // 🚨 FIX 1: Aggregate Onboarding Checkboxes into an Array
    const onboardingCheckboxes = document.querySelectorAll('input[name="onboardingRequirements"]:checked');
    const onboardingRequirementsArray = Array.from(onboardingCheckboxes).map(cb => cb.value);

    // 🚨 FIX 2 & 3: Ensure all new fields and correct mapping names are included
    const data = {
        // Simple Text/Select fields - snake_case names match index.ts record keys
        requester_name: formData.get('requesterName'),
        requester_email: formData.get('requesterEmail'),
        department: formData.get('department'),
        position_external_title: formData.get('positionExternalTitle'),
        position_career_level: formData.get('positionCareerLevel'),
        about_the_role: formData.get('aboutTheRole'),
        job_descriptions: formData.get('jobDescriptions'), 
        job_requirements: formData.get('jobRequirements'),
        position_reporting_to: formData.get('positionReportingTo'),
        
        // Budget Salary is now a single number string
        budget_salary: formData.get('budgetSalary'),
        
        requisition_type: formData.get('requisitionType'),
        reason_of_requisition: formData.get('reasonOfRequisition'),
        
        // 🚨 FIX 4: Map checkbox array to the correct key for the Monday Multi-Select
        onboarding_requirements: onboardingRequirementsArray,
        
        // 🚨 FIX 5: Capture the 'Name to be replaced' field
        name_to_be_replaced: formData.get('nameToBeReplaced'),
        
        // 🚨 FIX 6: Capture the 'Other Requirements' field
        other_requirements: formData.get('otherRequirements'),

        additional_comments: formData.get('additionalComments'),
        requested_date: formData.get('requestedDate'),
        
        // The old, separate boolean checkboxes are REMOVED as they are replaced by the array above.
    };
    
    // 2. Call the Edge Function again, but this time for saving data
    // NOTE: If you are sending this to the 'ai-generator' function, 
    // you must ensure that function is configured to handle the 'submit' action 
    // and trigger the separate 'monday-webhook' function or database insert. 
    // Assuming the setup requires an action field:
    try {
        const saveResponse = await fetch(AI_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            // Send the entire form data payload
            body: JSON.stringify({ 
                action: 'submit',
                payload: data 
            }),
        });

        if (!saveResponse.ok) {
            throw new Error(`Submission failed with status: ${saveResponse.status}`);
        }
        
        const saveResult = await saveResponse.json();

        if (saveResult.error) {
            alert(`Submission Error: ${saveResult.error}`);
            console.error('Submission Error:', saveResult.error);
        } else {
            // NOTE: Assuming the save function returns an ID or confirmation
            alert('Form submitted successfully! Your requisition ID is: ' + (saveResult.id || 'N/A'));
            form.reset(); // Clear the form on success
            jobDescriptionsTextarea.value = ''; // Reset JD field
            isTextEditable = false;
            updateJdActions(false);
            jdStatusMessage.textContent = "Enter keywords and click 'Generate JD' to get started.";
            jdStatusMessage.style.color = 'var(--secondary-color)';
        }

    } catch (error) {
        alert('An unexpected error occurred during submission. See console for details.');
        console.error('Submission Error:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
});

// Initial state setup
jobDescriptionsTextarea.readOnly = true;
updateJdActions(false);
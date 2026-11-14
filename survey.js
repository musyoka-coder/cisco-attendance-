const surveyDb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
const surveyParams = new URLSearchParams(location.hash.slice(1));
const surveyToken = surveyParams.get('survey');
let surveyDefinition = null;
const surveyMessage = document.getElementById('survey-message');
async function loadSurvey() {
  try {
    if (!surveyToken) throw Error('Open the survey link sent by your trainer.');
    const { data, error } = await surveyDb.rpc('get_learner_survey', {
      p_token: surveyToken,
    });
    if (error) throw error;
    surveyDefinition = data;
    document.getElementById('survey-title').textContent = data.title;
    document.getElementById('survey-close').textContent =
      'Closes: ' +
      new Date(data.closes_at).toLocaleString('en-KE', {
        timeZone: 'Africa/Nairobi',
      }) +
      ' (Kenya time)';
    data.learners.forEach((learner) => {
      const option = document.createElement('option');
      option.value = learner.id;
      option.textContent = learner.name;
      document.getElementById('student').appendChild(option);
    });
    const learner = surveyParams.get('learner'),
      code = surveyParams.get('code');
    if (learner) document.getElementById('student').value = learner;
    if (code) {
      document.getElementById('access-code').value = code;
      document.getElementById('code-label').hidden = true;
    }
    document.getElementById('student').onchange = () => {
      document.getElementById('code-label').hidden = false;
    };
    data.questions.forEach((q, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'question';
      if (q.type === 'rating') {
        const fieldset = document.createElement('fieldset'),
          legend = document.createElement('legend');
        legend.textContent = `${index + 1}. ${q.label}`;
        fieldset.appendChild(legend);
        const choices = document.createElement('div');
        choices.className = 'ratings';
        ['1', '2', '3', '4', '5', 'na'].forEach((value) => {
          const label = document.createElement('label'),
            input = document.createElement('input');
          input.type = 'radio';
          input.name = q.id;
          input.value = value;
          input.required = true;
          label.append(
            input,
            document.createTextNode(
              value === 'na' ? 'Not sure / not applicable' : value,
            ),
          );
          choices.appendChild(label);
        });
        fieldset.appendChild(choices);
        wrapper.appendChild(fieldset);
      } else {
        const label = document.createElement('label');
        label.textContent = `${index + 1}. ${q.label} (optional)`;
        const input = document.createElement('textarea');
        input.name = q.id;
        input.maxLength = 2000;
        label.appendChild(input);
        wrapper.appendChild(label);
      }
      document.getElementById('questions').appendChild(wrapper);
    });
    document.getElementById('survey-card').hidden = false;
    surveyMessage.textContent = '';
  } catch (error) {
    surveyMessage.textContent = error.message;
    surveyMessage.className = 'error';
  }
}
document
  .getElementById('survey-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('submit-survey');
    button.disabled = true;
    surveyMessage.textContent = 'Saving your feedback…';
    try {
      const form = new FormData(event.target),
        answers = {};
      surveyDefinition.questions.forEach((q) => {
        const value = form.get(q.id);
        answers[q.id] =
          q.type === 'rating'
            ? value === 'na'
              ? 'na'
              : Number(value)
            : String(value || '').trim();
      });
      const { data, error } = await surveyDb.rpc('submit_learner_survey', {
        p_token: surveyToken,
        p_student: Number(document.getElementById('student').value),
        p_code: document.getElementById('access-code').value.trim(),
        p_answers: answers,
      });
      if (error) throw error;
      document.getElementById('survey-card').hidden = true;
      document.getElementById('survey-success').hidden = false;
      surveyMessage.textContent = data.already_submitted
        ? 'Your earlier response was already saved. No duplicate was created.'
        : '';
    } catch (error) {
      surveyMessage.textContent = 'Could not submit: ' + error.message;
      surveyMessage.className = 'error';
      button.disabled = false;
    }
  });
loadSurvey();

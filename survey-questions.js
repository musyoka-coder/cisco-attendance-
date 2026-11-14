const SURVEY_QUESTIONS = [
  {
    "id": "netacad",
    "type": "rating",
    "label": "I understand the topics taught on Cisco NetAcad.",
    "required": true
  },
  {
    "id": "practical",
    "type": "rating",
    "label": "I can carry out the practical tasks after the lesson.",
    "required": true
  },
  {
    "id": "explanations",
    "type": "rating",
    "label": "My teacher explains difficult topics clearly.",
    "required": true
  },
  {
    "id": "knowledge",
    "type": "rating",
    "label": "My teacher demonstrates the skills needed to teach the course.",
    "required": true
  },
  {
    "id": "support",
    "type": "rating",
    "label": "I receive help when I struggle or ask a question.",
    "required": true
  },
  {
    "id": "practice_time",
    "type": "rating",
    "label": "I get enough time and equipment to practise.",
    "required": true
  },
  {
    "id": "feedback",
    "type": "rating",
    "label": "The feedback I receive helps me improve.",
    "required": true
  },
  {
    "id": "respect",
    "type": "rating",
    "label": "My teacher treats learners fairly and respectfully.",
    "required": true
  },
  {
    "id": "satisfaction",
    "type": "rating",
    "label": "Overall, I am satisfied with my Cisco training.",
    "required": true
  },
  {
    "id": "likes",
    "type": "text",
    "label": "What do you like most about your teacher or the lessons?",
    "required": false
  },
  {
    "id": "improve",
    "type": "text",
    "label": "What do you dislike, or what should the teacher do differently?",
    "required": false
  },
  {
    "id": "difficult_topics",
    "type": "text",
    "label": "Which NetAcad topics or practical tasks do you find difficult?",
    "required": false
  },
  {
    "id": "suggestions",
    "type": "text",
    "label": "What changes would help you learn better?",
    "required": false
  }
];
if(typeof module!=="undefined")module.exports=SURVEY_QUESTIONS;

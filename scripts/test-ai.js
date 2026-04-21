// Test script
async function testEditorAPI() {
  const body = {
    messages: [
      { role: 'user', content: "Crée une arborescence de cours sur l'anatomie avec 2 parties et 2 chapitres." }
    ],
    context: {
      projectName: "TestProj",
    }
  };

  const response = await fetch('http://localhost:3001/api/ai/editor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Authorization': '...'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

testEditorAPI();

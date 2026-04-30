// test-socratic.js
async function testSocraticAPI() {
  const body = {
    messages: [
      { role: 'user', content: "Explique l'atome" }
    ],
    context: {
      docName: "Chimie 101",
      paraName: "L'atome",
      notionContent: "L'atome est la plus petite unité de la matière..."
    }
  };

  try {
    const response = await fetch('http://localhost:3001/api/ai/socratic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // 'Authorization': '...' (If needed)
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error('Erreur:', response.status, await response.text());
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(decoder.decode(value, { stream: true }));
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testSocraticAPI();

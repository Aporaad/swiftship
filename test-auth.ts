import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'admin' })
    });
    console.log(res.status, res.headers.get('content-type'));
    const text = await res.text();
    console.log(text.substring(0, 500));
  } catch (e) {
    console.error(e);
  }
}
test();

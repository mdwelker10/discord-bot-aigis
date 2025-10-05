function generateStateString() {
  let str = '';
  const randNum = Math.floor(Math.random() * 10);
  for (let i = 0; i < 20 + randNum; i++) {
    str += String.fromCharCode(33 + Math.floor(Math.random() * 94));
  }
  return str;
}

window.onload = async () => {
  try {
    const res = await fetch("/me", { credentials: "include" });
    if (!res.ok) {
      document.getElementById("login").style.display = "block";
      document.getElementById("info").innerText = "You are not logged in.";
      return;
    }
    const user = await res.json();
    if (user.username) {
      document.getElementById("info").innerText = `Hello ${user.username}!`;
      document.getElementById("login").style.display = "none";
    } else {
      document.getElementById("login").style.display = "block";
      document.getElementById("info").innerText = "You are not logged in.";
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    document.getElementById("login").style.display = "block";
    document.getElementById("info").innerText = "You are not logged in.";
  }
};
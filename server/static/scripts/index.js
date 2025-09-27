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
    }
    const user = await res.json();

    if (user.username) {
      document.getElementById("info").innerText = `Hello ${user.username}!`;
    }
  } catch (err) {
    document.getElementById("login").style.display = "block";
  }
};
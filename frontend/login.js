const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {

        const response = await fetch("/login", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {

    localStorage.setItem("userId", data.user.id);
    localStorage.setItem("userName", data.user.name);

    alert("Login successful!");

    window.location.href = "main.html";

} else {

            alert(data.message);

        }

    } catch (error) {

        console.error(error);

        alert("Could not connect to the server.");

    }

});
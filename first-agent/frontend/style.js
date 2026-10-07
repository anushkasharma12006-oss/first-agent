/* ========================================
   FIRST-AGENT
   FRONTEND JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* ========================================
       ELEMENTS
    ======================================== */

    const app = document.querySelector(".app");
    const sidebarToggle = document.getElementById("sidebarToggle");

    const newChatButton = document.getElementById("newChat");
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");

    const themeButton = document.querySelector(".icon-button");


    /* ========================================
       SIDEBAR
    ======================================== */

    if (sidebarToggle && app) {

        sidebarToggle.addEventListener("click", () => {

            app.classList.toggle("sidebar-collapsed");

            const collapsed =
                app.classList.contains("sidebar-collapsed");

            sidebarToggle.textContent =
                collapsed ? "»" : "«";

        });

    }


    /* ========================================
       NEW CHAT
    ======================================== */

    if (newChatButton && messageInput) {

        newChatButton.addEventListener("click", () => {

            messageInput.value = "";

            messageInput.style.height = "auto";

            messageInput.focus();

        });

    }


    /* ========================================
       MESSAGE TEXTAREA
    ======================================== */

    if (messageInput) {

        // Auto resize
        messageInput.addEventListener("input", () => {

            messageInput.style.height = "auto";

            messageInput.style.height =
                Math.min(messageInput.scrollHeight, 150) + "px";

        });


        // Enter = send
        // Shift + Enter = new line
        messageInput.addEventListener("keydown", (event) => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        });

    }


    /* ========================================
       SEND BUTTON
    ======================================== */

    if (sendButton) {

        sendButton.addEventListener("click", () => {

            sendMessage();

        });

    }


    /* ========================================
       SEND MESSAGE
    ======================================== */

    function sendMessage() {

        if (!messageInput) {
            return;
        }

        const message =
            messageInput.value.trim();

        if (message === "") {
            return;
        }

        /*
         * Backend connection will be added later.
         * For now we only handle the frontend.
         */

        console.log("User message:", message);

        // Clear input
        messageInput.value = "";

        messageInput.style.height = "auto";

    }


    /* ========================================
       THEME BUTTON
    ======================================== */
const themeSelect = document.querySelector(".theme-select");

const savedTheme = localStorage.getItem("theme");

if (savedTheme === "light") {
    document.body.classList.add("light-mode");

    if (themeSelect) {
        themeSelect.value = "light";
    }
}

if (themeSelect) {
    themeSelect.addEventListener("change", () => {

        if (themeSelect.value === "light") {
            document.body.classList.add("light-mode");
            localStorage.setItem("theme", "light");
        } else {
            document.body.classList.remove("light-mode");
            localStorage.setItem("theme", "dark");
        }

    });
}


    /* ========================================
       ACTIVE NAVIGATION
    ======================================== */

    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

    const navItems =
        document.querySelectorAll(".nav-item");

    navItems.forEach((item) => {

        const href =
            item.getAttribute("href");

        if (!href) {
            return;
        }

        const targetPage =
            href.split("/")
                .pop()
                .toLowerCase();

        item.classList.remove("active");

        if (
            targetPage === currentPage ||
            (
                currentPage === "" &&
                targetPage === "main.html"
            )
        ) {

            item.classList.add("active");

        }

    });


    /* ========================================
       NEW CHAT PAGE
    ======================================== */

    const newChatLink =
        document.querySelector(
            'a[href="new.html"]'
        );

    if (newChatLink) {

        newChatLink.addEventListener("click", () => {

            console.log("Opening new chat...");

        });

    }


    /* ========================================
       LOGIN LINK
    ======================================== */

    const loginLink =
        document.querySelector(".login-link");

    if (loginLink) {

        loginLink.addEventListener("click", () => {

            console.log("Opening login...");

        });

    }


    /* ========================================
       SERVICE CARDS
    ======================================== */

    const serviceLinks =
        document.querySelectorAll(
            ".service-card a"
        );

    serviceLinks.forEach((link) => {

        link.addEventListener("click", () => {

            console.log(
                "Opening:",
                link.getAttribute("href")
            );

        });

    });


    /* ========================================
       BUTTON RIPPLE / PRESS EFFECT
    ======================================== */

    const buttons =
        document.querySelectorAll("button");

    buttons.forEach((button) => {

        button.addEventListener("mousedown", () => {

            button.classList.add("button-pressed");

        });

        button.addEventListener("mouseup", () => {

            button.classList.remove("button-pressed");

        });

        button.addEventListener("mouseleave", () => {

            button.classList.remove("button-pressed");

        });

    });

});
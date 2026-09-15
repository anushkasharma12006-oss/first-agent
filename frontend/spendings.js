// =========================
// SPENDING FORM
// =========================

const spendingForm = document.getElementById("spendingForm");


// =========================
// ADD EXPENSE
// =========================

spendingForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const name = document.getElementById("spendingName").value;
    const amount = document.getElementById("spendingAmount").value;
    const category = document.getElementById("spendingCategory").value;

    try {

        const response = await fetch("http://localhost:3000/expenses", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            const userId = localStorage.getItem("userId");

body: JSON.stringify({
    user_id: userId,
    name: name,
    amount: amount,
    category: category
})
        });

        const data = await response.json();

        if (response.ok) {

            alert("Spending added successfully!");

            spendingForm.reset();

            loadExpenses();

        } else {

            alert(data.message);

        }

    } catch (error) {

        console.error("Error:", error);

        alert("Could not connect to the server.");

    }

});


// =========================
// LOAD EXPENSES
// =========================

async function loadExpenses() {

    try {

  const userId = localStorage.getItem("userId");

const response = await fetch(
    `http://localhost:3000/expenses?userId=${userId}`
);

        const expenses = await response.json();

        if (!response.ok) {

            console.error(expenses.message);

            return;

        }

        displayExpenses(expenses);

    } catch (error) {

        console.error("Error loading expenses:", error);

    }

}


// =========================
// DISPLAY EXPENSES
// =========================

function displayExpenses(expenses) {

    const spendingList =
        document.getElementById("spendingList");

    const emptySpending =
        document.getElementById("emptySpending");


    // No expenses
    if (expenses.length === 0) {

        emptySpending.style.display = "block";

        return;

    }


    // Hide empty message
    emptySpending.style.display = "none";


    // Clear old list
    spendingList.innerHTML = "";


    // Calculate total
    let total = 0;


    expenses.forEach((expense) => {

        total += Number(expense.amount);


        const spendingItem =
            document.createElement("div");

        spendingItem.className = "spending-item";


        spendingItem.innerHTML = `

            <div>

                <h3>${expense.name}</h3>

                <p>${expense.category || "Other"}</p>

            </div>

            <div>

                <strong>
                    ₹${Number(expense.amount).toFixed(2)}
                </strong>

            </div>

        `;


        spendingList.appendChild(spendingItem);

    });


    // =========================
    // UPDATE TOTAL SPENDING
    // =========================

    const totalSpending =
        document.getElementById("totalSpending");


    if (totalSpending) {

        totalSpending.textContent =
            `₹${total.toFixed(2)}`;

    }

}


// =========================
// LOAD DATA WHEN PAGE OPENS
// =========================

loadExpenses();
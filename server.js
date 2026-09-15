import mysql from "mysql2/promise";
import Groq from "groq-sdk";
import bcrypt from "bcryptjs";

// =========================
// MYSQL CONNECTION
// =========================

const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

console.log("MySQL connected successfully!");

// =========================
// SERVER
// =========================

Bun.serve({
    port: 3000,

    async fetch(req) {

        // =========================
        // CORS
        // =========================

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        if (req.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        const url = new URL(req.url);

        // =========================
        // AI ASSISTANT
        // =========================

        if (url.pathname === "/ask-ai" && req.method === "POST") {

            try {

                const { question ,userId} = await req.json();

                if (!question) {
                    return Response.json(
                        {
                            message: "Question is required!"
                        },
                        {
                            status: 400,
                            headers: corsHeaders
                        }
                    );
                }
if (!userId) {
    return Response.json(
        { message: "User ID is required!" },
        {
            status: 400,
            headers: corsHeaders
        }
    );
}

                // =========================
                // GET EXPENSES FROM MYSQL
                // =========================

                const [expenses] = await db.execute(
                    `SELECT name, amount, category, created_at
                     FROM expenses
                     WHERE user_id = ?
                     ORDER BY created_at DESC`,
                    [userId]
                );

                // =========================
                // GET INCOME FROM MYSQL
                // =========================

                const [income] = await db.execute(
                    `SELECT source, amount, created_at
                     FROM income
                     WHERE user_id = ?
                     ORDER BY created_at DESC`,
                    [userId]
                );

                // =========================
                // CALCULATE TOTAL EXPENSE
                // =========================

                const totalExpense = expenses.reduce(
                    (total, expense) =>
                        total + Number(expense.amount),
                    0
                );

                // =========================
                // CALCULATE TOTAL INCOME
                // =========================

                const totalIncome = income.reduce(
                    (total, item) =>
                        total + Number(item.amount),
                    0
                );

                // =========================
                // CALCULATE BALANCE
                // =========================

                const balance = totalIncome - totalExpense;

                // =========================
                // SEND DATA TO AI
                // =========================

                const completion =
                    await groq.chat.completions.create({

                        model: "openai/gpt-oss-120b",

                        messages: [

                            {
                                role: "system",
                                content: `
You are Josh, a personal finance assistant.

Help the user manage their expenses, income and balance.

Be simple, friendly and clear.

User's financial data:

Expenses:
${JSON.stringify(expenses)}

Income:
${JSON.stringify(income)}

Total expenses:
${totalExpense} INR

Total income:
${totalIncome} INR

Current balance:
${balance} INR
`
                            },

                            {
                                role: "user",
                                content: question
                            }

                        ],

                        // =========================
                        // AI TOOLS
                        // =========================

                        tools: [

                            // =========================
                            // ADD EXPENSE
                            // =========================

                            {
                                type: "function",

                                function: {

                                    name: "addExpense",

                                    description:
                                        "Add a new expense to the user's financial database.",

                                    parameters: {

                                        type: "object",

                                        properties: {

                                            name: {
                                                type: "string",
                                                description:
                                                    "Name of the expense, for example shopping or food."
                                            },

                                            amount: {
                                                type: "number",
                                                description:
                                                    "Amount of the expense in INR."
                                            },

                                            category: {
                                                type: "string",
                                                description:
                                                    "Category of the expense, for example Food, Shopping or Travel."
                                            }

                                        },

                                        required: [
                                            "name",
                                            "amount"
                                        ]

                                    }

                                }

                            },

                            // =========================
                            // ADD INCOME
                            // =========================

                            {
                                type: "function",

                                function: {

                                    name: "addIncome",

                                    description:
                                        "Add a new income to the user's financial database.",

                                    parameters: {

                                        type: "object",

                                        properties: {

                                            name: {
                                                type: "string",
                                                description:
                                                    "Name of the income, for example salary or pocket money."
                                            },

                                            amount: {
                                                type: "number",
                                                description:
                                                    "Amount of the income in INR."
                                            }

                                        },

                                        required: [
                                            "name",
                                            "amount"
                                        ]

                                    }

                                }

                            },

                            // =========================
                            // GET MONEY BALANCE
                            // =========================

                            {
                                type: "function",

                                function: {

                                    name: "getMoneyBalance",

                                    description:
                                        "Get the user's remaining money balance from their income and expenses.",

                                    parameters: {
                                        type: "object",
                                        properties: {}
                                    }

                                }

                            },

                            // =========================
                            // GET TOTAL EXPENSE
                            // =========================

                            {
                                type: "function",

                                function: {

                                    name: "getTotalExpense",

                                    description:
                                        "Get the total amount of expenses from the user's financial database.",

                                    parameters: {
                                        type: "object",
                                        properties: {}
                                    }

                                }

                            }

                        ]

                    });

                // =========================
                // HANDLE AI TOOL CALL
                // =========================

                const toolCalls =
                    completion.choices[0].message.tool_calls;

                if (toolCalls) {

                    for (const tool of toolCalls) {

                        const functionName =
                            tool.function.name;

                        const functionArgs =
                            JSON.parse(tool.function.arguments);

                        // =========================
                        // ADD EXPENSE
                        // =========================

                        if (functionName === "addExpense") {

                            const result =
                                await addExpense(functionArgs,userId);

                            return Response.json(
                                {
                                    answer: result
                                },
                                {
                                    headers: corsHeaders
                                }
                            );
                        }

                        // =========================
                        // ADD INCOME
                        // =========================

                        if (functionName === "addIncome") {

                            const result =
                                await addIncome(functionArgs,userId);

                            return Response.json(
                                {
                                    answer: result
                                },
                                {
                                    headers: corsHeaders
                                }
                            );
                        }

                        // =========================
                        // GET MONEY BALANCE
                        // =========================

                        if (functionName === "getMoneyBalance") {

                            const result =
                                await getMoneyBalance(userId);

                            return Response.json(
                                {
                                    answer: result
                                },
                                {
                                    headers: corsHeaders
                                }
                            );
                        }

                        // =========================
                        // GET TOTAL EXPENSE
                        // =========================

                        if (functionName === "getTotalExpense") {

                            const result =
                                await getTotalExpense(userId);

                            return Response.json(
                                {
                                    answer: result
                                },
                                {
                                    headers: corsHeaders
                                }
                            );
                        }

                    }
                }

                // =========================
                // NORMAL AI RESPONSE
                // =========================

                const answer =
                    completion.choices[0].message.content;

                return Response.json(
                    {
                        answer: answer
                    },
                    {
                        headers: corsHeaders
                    }
                );

            } catch (error) {

                console.error("AI error:", error);

                return Response.json(
                    {
                        message: "AI request failed!",
                        error: error.message
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // REGISTER API
        // =========================

        if (url.pathname === "/register" && req.method === "POST") {

            try {

                const { name, email, password } =
                    await req.json();

                // Check if email already exists
                const [existingUser] =
                    await db.execute(
                        "SELECT id FROM users WHERE email = ?",
                        [email]
                    );

                if (existingUser.length > 0) {

                    return Response.json(
                        {
                            message: "Email already registered!"
                        },
                        {
                            status: 400,
                            headers: corsHeaders
                        }
                    );
                }

                // Insert new user
       const passwordHash = await bcrypt.hash(password, 10);

await db.execute(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
    [name, email, passwordHash]
);
                return Response.json(
                    {
                        message: "Account created successfully!"
                    },
                    {
                        headers: corsHeaders
                    }
                );

            } catch (error) {

                console.error(
                    "Registration error:",
                    error
                );

                return Response.json(
                    {
                        message: "Registration failed!"
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // ADD EXPENSE
        // =========================

        if (url.pathname === "/expenses" && req.method === "POST") {

            try {

                const {
                    user_id,
                    name,
                    amount,
                    category
                } = await req.json();

                console.log(
                    "EXPENSE RECEIVED:",
                    user_id,
                    name,
                    amount,
                    category
                );

                await db.execute(
                    `INSERT INTO expenses
                     (user_id, name, amount, category)
                     VALUES (?, ?, ?, ?)`,
                    [
                        user_id,
                        name,
                        amount,
                        category
                    ]
                );

                console.log("EXPENSE INSERTED!");

                return Response.json(
                    {
                        message: "Expense added successfully!"
                    },
                    {
                        headers: corsHeaders
                    }
                );

            } catch (error) {

                console.error(
                    "Expense error:",
                    error
                );

                return Response.json(
                    {
                        message: "Failed to add expense!"
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // GET EXPENSES
        // =========================

        if (url.pathname === "/expenses" && req.method === "GET") {

            try {

                const userId = url.searchParams.get("userId");

if (!userId) {
    return Response.json(
        { message: "User ID is required!" },
        { status: 400, headers }
    );
}

                const [expenses] =
                    await db.execute(
                        `SELECT id, name, amount, category, created_at
                         FROM expenses
                         WHERE user_id = ?
                         ORDER BY created_at DESC`,
                        [userId]
                    );

                return Response.json(
                    expenses,
                    {
                        headers: corsHeaders
                    }
                );

            } catch (error) {

                console.error(
                    "Get expenses error:",
                    error
                );

                return Response.json(
                    {
                        message: "Failed to fetch expenses!"
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // LOGIN API
        // =========================

        if (url.pathname === "/login" && req.method === "POST") {

            try {

                const {
                    email,
                    password
                } = await req.json();

                const [users] =
                    await db.execute(
                        "SELECT id, name, email, password_hash FROM users WHERE email = ?",
                        [email]
                    );

                if (users.length === 0) {

                    return Response.json(
                        {
                            message:
                                "Invalid email or password!"
                        },
                        {
                            status: 401,
                            headers: corsHeaders
                        }
                    );
                }

                const user = users[0];

              const passwordMatch = await bcrypt.compare(
    password,
    user.password_hash
);

if (!passwordMatch) {

                    return Response.json(
                        {
                            message:
                                "Invalid email or password!"
                        },
                        {
                            status: 401,
                            headers: corsHeaders
                        }
                    );
                }

                return Response.json(
                    {
                        message: "Login successful!",

                        user: {
                            id: user.id,
                            name: user.name,
                            email: user.email
                        }
                    },
                    {
                        headers: corsHeaders
                    }
                );

            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );

                return Response.json(
                    {
                        message: "Login failed!"
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // HTML PAGES
        // =========================

        if (url.pathname === "/login.html") {

            return new Response(
                await Bun.file(
                    "./frontend/login.html"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "text/html"
                    }
                }
            );
        }

        if (url.pathname === "/register.html") {

            return new Response(
                await Bun.file(
                    "./frontend/register.html"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "text/html"
                    }
                }
            );
        }

        // =========================
        // AGENTS PAGE
        // =========================

        if (url.pathname === "/agents.html") {

            return new Response(
                await Bun.file(
                    "./frontend/agents.html"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "text/html"
                    }
                }
            );
        }

        // =========================
        // MAIN PAGE
        // =========================

        if (url.pathname === "/main.html") {

            return new Response(
                await Bun.file(
                    "./frontend/main.html"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "text/html"
                    }
                }
            );
        }

        // =========================
        // SPENDINGS PAGE
        // =========================

        if (url.pathname === "/spendings.html") {

            return new Response(
                await Bun.file(
                    "./frontend/spendings.html"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "text/html"
                    }
                }
            );
        }

        // =========================
        // SPENDINGS JAVASCRIPT
        // =========================

        if (url.pathname === "/spendings.js") {

            return new Response(
                await Bun.file(
                    "./frontend/spendings.js"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type":
                            "application/javascript"
                    }
                }
            );
        }

        // =========================
        // CSS FILE
        // =========================

        if (url.pathname === "/style.css") {

            return new Response(
                await Bun.file(
                    "./frontend/style.css"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "text/css"
                    }
                }
            );
        }

        // =========================
        // STYLE JAVASCRIPT
        // =========================

        if (url.pathname === "/style.js") {

            return new Response(
                await Bun.file(
                    "./frontend/style.js"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type":
                            "application/javascript"
                    }
                }
            );
        }

        // =========================
        // REGISTER JAVASCRIPT
        // =========================

        if (url.pathname === "/register.js") {

            return new Response(
                await Bun.file(
                    "./frontend/register.js"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type":
                            "application/javascript"
                    }
                }
            );
        }

        // =========================
        // LOGIN JAVASCRIPT
        // =========================

        if (url.pathname === "/login.js") {

            return new Response(
                await Bun.file(
                    "./frontend/login.js"
                ).text(),

                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type":
                            "application/javascript"
                    }
                }
            );
        }

        // =========================
        // DEFAULT RESPONSE
        // =========================

        return new Response(
            "First-Agent Server is running!",
            {
                headers: corsHeaders
            }
        );
    }
});

console.log(
    "Server running at http://localhost:3000"
);

// =========================
// AI FINANCE FUNCTIONS
// =========================

// =========================
// AI FINANCE FUNCTIONS
// =========================

async function getTotalExpense(userId) {

    const [expenses] = await db.execute(
        `SELECT amount
         FROM expenses
         WHERE user_id = ?`,
        [userId]
    );

    const total = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0
    );

    return `${total} INR`;
}


async function addExpense({ name, amount, category }, userId) {

    await db.execute(
        `INSERT INTO expenses
         (user_id, name, amount, category)
         VALUES (?, ?, ?, ?)`,
        [userId, name, amount, category || "Other"]
    );

    return "Expense added successfully.";
}


async function addIncome({ name, amount }, userId) {

    await db.execute(
        `INSERT INTO income
         (user_id, source, amount)
         VALUES (?, ?, ?)`,
        [userId, name, amount]
    );

    return "Income added successfully.";
}


async function getMoneyBalance(userId) {

    const [income] = await db.execute(
        `SELECT amount
         FROM income
         WHERE user_id = ?`,
        [userId]
    );

    const [expenses] = await db.execute(
        `SELECT amount
         FROM expenses
         WHERE user_id = ?`,
        [userId]
    );

    const totalIncome = income.reduce(
        (sum, item) => sum + Number(item.amount),
        0
    );

    const totalExpense = expenses.reduce(
        (sum, item) => sum + Number(item.amount),
        0
    );

    return `${totalIncome - totalExpense} INR`;
}
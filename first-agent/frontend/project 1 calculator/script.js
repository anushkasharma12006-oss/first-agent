/* ========================================
   FIRST-AGENT CALCULATOR
   JAVASCRIPT
======================================== */

const display = document.getElementById("display");


/* ========================================
   APPEND VALUE
======================================== */

function append(value) {

    // If display currently shows an error
    if (display.value === "Error") {
        display.value = "0";
    }

    // Replace initial zero
    if (display.value === "0" && value !== ".") {
        display.value = value;
        return;
    }

    // Prevent multiple decimal points in one number
    if (value === ".") {

        const parts = display.value.split(/[\+\-\*\/%]/);
        const currentNumber = parts[parts.length - 1];

        if (currentNumber.includes(".")) {
            return;
        }
    }

    // Prevent two operators together
    if (["+", "-", "*", "/", "%"].includes(value)) {

        const lastCharacter =
            display.value.charAt(display.value.length - 1);

        if (["+", "-", "*", "/", "%"].includes(lastCharacter)) {
            display.value =
                display.value.slice(0, -1) + value;
            return;
        }
    }

    display.value += value;
}


/* ========================================
   CLEAR ALL
======================================== */

function clearAll() {
    display.value = "0";
}


/* ========================================
   DELETE LAST CHARACTER
======================================== */

function deleteLast() {

    if (
        display.value === "Error" ||
        display.value.length <= 1
    ) {
        display.value = "0";
        return;
    }

    display.value = display.value.slice(0, -1);
}


/* ========================================
   CALCULATE
======================================== */

function calculate() {

    try {

        let expression = display.value;

        // Don't calculate empty display
        if (!expression || expression === "0") {
            return;
        }

        // Convert percentage into decimal
        expression = expression.replace(
            /(\d+(\.\d+)?)%/g,
            "($1/100)"
        );

        // Allow only calculator characters
        if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
            throw new Error("Invalid expression");
        }

        const result = Function(
            `"use strict"; return (${expression})`
        )();

        if (!Number.isFinite(result)) {
            throw new Error("Invalid result");
        }

        // Avoid unnecessary decimal digits
        display.value =
            Number.isInteger(result)
                ? result.toString()
                : parseFloat(result.toFixed(10)).toString();

    } catch (error) {

        display.value = "Error";

    }
}


/* ========================================
   KEYBOARD SUPPORT
======================================== */

document.addEventListener("keydown", (event) => {

    const key = event.key;

    // Numbers
    if (/^[0-9]$/.test(key)) {
        append(key);
        return;
    }

    // Operators
    if (["+", "-", "*", "/", "%"].includes(key)) {
        append(key);
        return;
    }

    // Decimal
    if (key === ".") {
        append(".");
        return;
    }

    // Enter / =
    if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculate();
        return;
    }

    // Backspace
    if (key === "Backspace") {
        deleteLast();
        return;
    }

    // Escape
    if (key === "Escape") {
        clearAll();
    }

});
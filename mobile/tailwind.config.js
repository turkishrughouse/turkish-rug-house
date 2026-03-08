/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: "#1a1a1a",
                accent: "#c0a080",
                background: "#f9f9f9",
                card: "#ffffff",
            },
            fontFamily: {
                sans: ["System"], // We can add custom fonts later if needed
                serif: ["System"],
            },
        },
    },
    plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./utils/**/*.{js,ts,jsx,tsx}",
        "./context/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                korda: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                },
            },
            animation: {
                'research-bar': 'research-bar 2.5s ease-in-out infinite',
            },
            keyframes: {
                'research-bar': {
                    '0%': { width: '5%', marginLeft: '0%' },
                    '50%': { width: '40%', marginLeft: '30%' },
                    '100%': { width: '5%', marginLeft: '95%' },
                },
            },
        }
    },
    plugins: [],
}

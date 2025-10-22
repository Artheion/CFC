/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#d03333",
        "background-light": "#f8f6f6",
        "background-dark": "#19191E",
        "card-dark": "#2c2c2c",
        "rarity-common": "#ffffff",
        "rarity-uncommon": "#1eff00",
        "rarity-rare": "#0070dd",
        "rarity-epic": "#a335ee",
        "rarity-legendary": "#ff8000",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0",
        lg: "0",
        xl: "0",
        full: "9999px",
      },
      backgroundImage: {
        'coop': 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBwFu9QgBoBiSiaqu6G9LctMJNjvBWIWp6mCBfphbFQtuQrMjaqUKEggOOOFuO6TxqdX1XG8wU-a0r0lHD0sw4iCFWwt4hWDhZk76Wc-3aAs6muldm7RTzi1EaXue3ghhQIK8oDdLr77D_5FGr_ut2N0zh9JlQGgLs2K0jx6se5a3a_ETfxfw-UdTHzdx6D0BNcoV5yOp2EJFv6v27IACs3Y5LiH7uthrO6wfo4gRhUDzSOWxAnpVVOjYvmh2PtQeoCjWJ_aFgCtsjz")',
        'cock-1': 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBNdR280r1DfkQlFaPMrp2m3auOto-q32CV9NAP9PXYrToHIkn3vlXuLkYQdqLhUFiXjmFWMRruUTvpbUV50IkEAWMbJN9AKxknxJ_lI4WdXzx1DjSVCc1oI9PNmh07LpYw9aiGSRp_aWbzJC9r3dEU9HYRzn8r6QLBj7FsumGKjmmAjxEYKxVZWFxuVe_4nsvC4aLO0MYIV1yeGge7XWR0Z8XOaUBPlVJuGGAkouyY_5L6xMtIMOQEHp9ftlot6djDOpNVrELNFbKi")',
        'cock-2': 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC3OuUsTJm_FRj0kvUFuLFg4YtXUY0-5X3_zq--WN8VRAbHcUn0_4NXXlcmNgKA8e9sPg9W5y2pDMkeh8Z51gVs9Vt_IQN8HocTrnqlWRjNjz9LcjoEkTCHgJ8BdtgzfhMCXpjGklmTMhZDIzR2Ury-OFwL9-jTvXK-HlrRf-q_yImEv34v9EMqsOpMsDqo-QNNK5xqtS3Hy-C2eV3rmVhBkLjsoYZpJt8W-3GAcWRl-vvgSoiRZH9N2QvPa0IMYoX66ZzLRmTMfITJ")',
        'cock-3': 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAhSZ3Kmneb6L04kWaqyE7KiJJIrYYRydIVgNQY0BO8r8Zlp9Px6kIBKTzXE1cjHMYn3ny-gtJXs4YQirOL4pw94tMOUMpzIBOzMDqqjgfCdl_ysGKFySAnq42g3U2aseD-06bwYfkMMvwiRG6aiHpUzHMk2I-OzsxeC7l42YhX7GHdOaHOJuLgh6JKtkKsx1ho0BULgHclve_-U6J9aA8ysw6-LNXnqFrGJnw7GcdHaywylE4bJLeQimt5Z-4y6ZBYlULVEIS6yspd")',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
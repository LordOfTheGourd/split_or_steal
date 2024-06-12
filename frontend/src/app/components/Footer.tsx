// src/components/Footer.tsx

import React from "react";

const Footer = () => {
  return (
    <footer
      className="w-full py-4 flex justify-center"
      style={{ backgroundColor: "transparent" }}
    >
      <div className="max-w-screen-lg w-full flex items-center justify-center space-x-8 text-2xl font-bold mb-2">
        <a
          href="https://github.com/your-repo"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          GitHub
        </a>
        <a
          href="https://x.com/your-profile"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          &#120299;
        </a>
        <a href="#faq" className="hover:underline">
          FAQ
        </a>
      </div>
    </footer>
  );
};

export default Footer;

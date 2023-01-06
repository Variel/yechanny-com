import { merge } from "theme-ui";
import parentTheme from "@lekoarts/gatsby-theme-minimal-blog/src/gatsby-plugin-theme-ui/index";

const theme = merge(parentTheme, {
  fonts: {
    body: `"Pretendard Variable", -apple-system, BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"`,
  },
  fontSizes: [
    "14px",
    "16px",
    "18px",
    "20px",
    "24px",
    "32px",
    "48px",
    "64px",
    "72px",
  ],
  styles: {
    p: {
      fontSize: [2, 2, 2, 3],
    },
    h1: {
      fontSize: [5, 6, 6, 7],
      mt: 5,
    },
    h2: {
      fontSize: [4, 5, 5, 6],
      mt: 5,
    },
    h3: {
      fontSize: [3, 4, 4, 5],
      mt: 4,
    },
    h4: {
      fontSize: [2, 3, 3, 4],
      mt: 3,
    },
    hr: {
      my: 4
    }
  },
  layout: {
    container: {
      maxWidth: `920px`,
    },
  },
});

export default theme;

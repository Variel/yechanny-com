import React, { useCallback, useEffect, useState } from "react";

const buttonStyle = {
  backgroundColor: "rgb(35, 131, 226)",
  borderRadius: "4px",
  border: "none",
  boxShadow: "rgb(55 53 47 / 16%) 1px 0px 0px inset",
  fontSize: "16px",
  fontWeight: "500",
  padding: "8px 16px",
  color: "white",
};

const GITHUB_BUILD_TOKEN = process.env.GATSBY_GITHUB_BUILD_TOKEN;

const PublishButton = () => {
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (window) {
      document.getElementsByTagName('html')[0].style.backgroundColor = 'white';
    }
  }, []);

  const handleClick = useCallback(async () => {
    if (!isBusy) {
      setIsBusy(true);
      await fetch(
        "https://api.github.com/repos/variel/yechanny-com/actions/workflows/workflow-trigger-publish.yml/dispatches",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${GITHUB_BUILD_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: `{"ref":"main"}`,
        }
      );
      setIsBusy(false);
    }
  }, [isBusy]);

  return (
    <button style={buttonStyle} onClick={handleClick} disabled={isBusy}>
      게시하기
    </button>
  );
};

export default PublishButton;

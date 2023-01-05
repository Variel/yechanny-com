/** @jsx jsx */
import React from "react";
import { Box, Container, jsx, get } from "theme-ui"
import MdxComponents from "@lekoarts/gatsby-theme-minimal-blog/src/components/mdx-components";
import TwitterTweetEmbed from "../../../components/TwitterTweetEmbed";

const AdditionalMdxComponents = {
  TwitterTweetEmbed: (props: any) => <TwitterTweetEmbed {...props} />,
  ...MdxComponents
};

export default AdditionalMdxComponents

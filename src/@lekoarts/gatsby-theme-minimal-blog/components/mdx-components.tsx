/** @jsx jsx */
import React from "react";
import { Box, Container, jsx, get } from "theme-ui"
import MdxComponents from "@lekoarts/gatsby-theme-minimal-blog/src/components/mdx-components";
import { TwitterTweetEmbed } from "react-twitter-embed";

const AdditionalMdxComponents = {
  TwitterTweetEmbed: (props: any) => <Box sx={{display: 'flex', justifyContent: 'center'}}><TwitterTweetEmbed {...props} /></Box>,
  ...MdxComponents
};

export default AdditionalMdxComponents

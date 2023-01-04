import React from "react";
import MdxComponents from "@lekoarts/gatsby-theme-minimal-blog/src/components/mdx-components";
import { TwitterTweetEmbed } from "react-twitter-embed";

const AdditionalMdxComponents = {
  TwitterTweetEmbed: (props: any) => <TwitterTweetEmbed {...props} />,
  ...MdxComponents
};

export default AdditionalMdxComponents

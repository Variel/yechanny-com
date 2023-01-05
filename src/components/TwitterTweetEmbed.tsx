/** @jsx jsx */
import React from "react";
import { Box, Container, jsx, get, css } from "theme-ui"
import { TwitterTweetEmbed as TweetEmbed } from "react-twitter-embed";

const TwitterTweetEmbed = (props) => {
  return <Box sx={{
    display: 'flex', justifyContent: 'center',
    '& > div': {
      width: '550px',
      maxWidth: '100%'
    }
  }}><TweetEmbed {...props} /></Box>
}

export default TwitterTweetEmbed;
"use strict";

const YAML = require("yaml");
const fs = require("fs-extra");
const { Readable } = require("stream");

console.log("[Download Notion]");

const config = {
  token: process.env.NOTION_API_KEY,
  databaseId: process.env.NOTION_DATABASE_ID,
  outputDir: process.env.NOTION_OUTPUT_DIR,
};

console.log(`config:`);
console.log(` - token: ${config.token.substring(0, 8)}...`);
console.log(` - databaseId: ${config.databaseId}...`);
console.log(` - outputDir: ${config.outputDir}...`);

//#region Notion APIs

const notionVersion = "2021-05-13";

const getBlocks = async (id) => {
  let hasMore = true;
  let blockContent = [];
  let startCursor = "";

  while (hasMore) {
    let url = `https://api.notion.com/v1/blocks/${id}/children`;

    if (startCursor) {
      url += `?start_cursor=${startCursor}`;
    }

    try {
      const result = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "Notion-Version": notionVersion,
          Authorization: `Bearer ${config.token}`,
        },
      }).then((res) => res.json());

      for (let childBlock of result.results) {
        if (childBlock.has_children) {
          childBlock.children = await getBlocks(childBlock.id);
        }
      }

      blockContent = blockContent.concat(result.results);
      startCursor = result.next_cursor;
      hasMore = result.has_more;
    } catch (e) {
      console.error(e.errorMessage);
    }
  }

  return blockContent;
};

const getPages = async () => {
  let hasMore = true;
  let startCursor = "";
  const url = `https://api.notion.com/v1/databases/${config.databaseId}/query`;
  const body = {
    page_size: 100,
  };

  const pages = [];

  while (hasMore) {
    if (startCursor) {
      body.start_cursor = startCursor;
    }

    try {
      const result = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          "Notion-Version": notionVersion,
          Authorization: `Bearer ${config.token}`,
        },
      }).then((res) => res.json());

      startCursor = result.next_cursor;
      hasMore = result.has_more;

      for (let page of result.results) {
        page.children = await getBlocks(page.id);
        pages.push(page);
      }
    } catch (e) {
      console.error(e.errorMessage);
    }
  }

  return pages;
};

//#endregion

//#region block-to-string

const { pipeExtend } = require("or-pipets");
const path = require("path");

const pick = (key) => (obj) => obj[key];

const ifTrue = (predicate, transformer, orElse) => (data) =>
  predicate(data) ? transformer(data) : orElse(data);

const id = (x) => x;

const annotateEquation = ifTrue(
  pick("equation"),
  ({ content }) => ({ content: `$${content}$` }),
  id
);
const annotateBold = ifTrue(
  pick("bold"),
  ({ content }) => ({ content: `**${content}**` }),
  id
);
const annotateItalic = ifTrue(
  pick("italic"),
  ({ content }) => ({ content: `_${content}_` }),
  id
);
const annotateCode = ifTrue(
  pick("code"),
  ({ content }) => ({ content: `\`${content}\`` }),
  id
);
const annotateStrikethrough = ifTrue(
  pick("strikethrough"),
  ({ content }) => ({ content: `~~${content}~~` }),
  id
);
const annotateUnderline = ifTrue(
  pick("underline"),
  ({ content }) => ({ content: `<u>${content}</u>` }),
  id
);
const annotateColor = ifTrue(
  ({ color }) => color != "default",
  ({ content, color }) => ({
    content: `<span notion-color="${color}">${content}</span>`,
  }),
  id
);
const annotateLink = ifTrue(
  pick("link"),
  ({ content, link }) => ({
    content: `[${content}](${link.url ? link.url : link})`,
  }),
  id
);

const stylize = pipeExtend(annotateBold)
  .pipeExtend(annotateItalic)
  .pipeExtend(annotateCode)
  .pipeExtend(annotateStrikethrough)
  .pipeExtend(annotateUnderline)
  .pipeExtend(annotateColor)
  .pipeExtend(annotateLink)
  .pipeExtend(annotateEquation);

const blockToString = (textBlocks) =>
  textBlocks.reduce((text, textBlock) => {
    const data = {
      ...textBlock.text,
      ...textBlock.annotations,
    };

    if (textBlock.type == "equation") {
      data.content = textBlock.equation.expression;
      data.equation = true;
    }

    if (textBlock.type == "mention") {
      if (textBlock.mention.type == "user") {
        data.content = textBlock.plain_text;
      }

      if (textBlock.mention.type == "date") {
        if (textBlock.mention.date.end) {
          data.content = `${textBlock.mention.date.start} → ${textBlock.mention.date.start}`;
        } else {
          data.content = textBlock.mention.date.start;
        }

        data.content = `<time datetime="${data.content}">${data.content}</time>`;
      }

      if (textBlock.mention.type == "page") {
        data.content = textBlock.plain_text;
      }
    }

    return text.concat(stylize.process(data).content);
  }, "");

//#endregion

//#region Notion Properties

const getPageTitle = (page) => {
  const titleProperty = Object.keys(page.properties).find(
    (key) => page.properties[key].type == "title"
  );

  return blockToString(page.properties[titleProperty].title);
};

const getPageProperties = (page) =>
  Object.keys(page.properties).reduce((acc, key) => {
    if (page.properties[key].type == "title") {
      return acc;
    }

    if (page.properties[key].type == "rich_text") {
      page.properties[key].rich_text = blockToString(
        page.properties[key].rich_text
      );
    }

    if (page.properties[key].type == "select") {
      page.properties[key][page.properties[key].type] =
        page.properties[key][page.properties[key].type].name;
    }

    if (page.properties[key].type == "multi_select") {
      page.properties[key][page.properties[key].type] = page.properties[key][
        page.properties[key].type
      ].map((item) => item.name);
    }

    if (page.properties[key].type == "date") {
      page.properties[key][page.properties[key].type] =
        page.properties[key][page.properties[key].type].start;
    }

    return {
      ...acc,
      [key]: {
        id: page.properties[key].id,
        key,
        value: page.properties[key][page.properties[key].type],
        type: page.properties[key].type,
      },
    };
  }, {});

//#endregion

//#region Notion Block to Markdown

const EOL_MD = "\n";
const DOUBLE_EOL_MD = EOL_MD.repeat(2);

// Inserts the string at the beginning of every line of the content. If the useSpaces flag is set to
// true, the lines after the first will instead be prepended with two spaces.
const prependToLines = (content, string, useSpaces = true) => {
  let [head, ...tail] = content.split("\n");

  return [
    `${string} ${head}`,
    ...tail.map((line) => {
      return `${useSpaces ? " " : string} ${line}`;
    }),
  ].join("\n");
};

// Converts a notion block to a markdown string.
const blockToMarkdown = (block, lowerTitleLevel) => {
  // Get the child content of the block.
  let childMarkdown = (block.children ?? [])
    .map((block) => blockToMarkdown(block, lowerTitleLevel))
    .join("")
    .trim();

  // If the block is a page, return the child content.
  if (block.object === "page") {
    return childMarkdown;
  }

  // Extract the remaining content of the block and combine it with its children.
  let blockMarkdown = block[block.type]?.text
    ? blockToString(block[block.type]?.text).trim()
    : null;
  let markdown = [blockMarkdown, childMarkdown]
    .filter((text) => text)
    .join(DOUBLE_EOL_MD);

  // Table row
  // TODO: This should be moved to the new Notion type.
  if (
    block.type == "paragraph" &&
    blockMarkdown.startsWith("|") &&
    blockMarkdown.endsWith("|")
  ) {
    return markdown.concat(EOL_MD);
  }

  // Paragraph
  if (block.type == "paragraph") {
    return [EOL_MD, markdown, EOL_MD].join("");
  }

  // Heading
  if (block.type.startsWith("heading_")) {
    const headingLevel = Number(block.type.split("_")[1]);
    let symbol = (lowerTitleLevel ? "#" : "") + "#".repeat(headingLevel);
    return [EOL_MD, prependToLines(markdown, symbol), EOL_MD].join("");
  }

  // To do list item
  if (block.type == "to_do") {
    let symbol = `- [${block.to_do.checked ? "x" : " "}] `;
    return prependToLines(markdown, symbol).concat(EOL_MD);
  }

  // Bulleted list item
  if (block.type == "bulleted_list_item") {
    return prependToLines(markdown, "*").concat(EOL_MD);
  }

  // Numbered list item
  if (block.type == "numbered_list_item") {
    return prependToLines(markdown, "1.").concat(EOL_MD);
  }

  // Toggle
  if (block.type == "toggle") {
    return [
      EOL_MD,
      "<details><summary>",
      blockMarkdown,
      "</summary>",
      childMarkdown,
      "</details>",
      EOL_MD,
    ].join("");
  }

  // Code
  if (block.type == "code") {
    return [
      EOL_MD,
      `\`\`\` ${block.code.language}${EOL_MD}`,
      blockMarkdown,
      EOL_MD,
      "```",
      EOL_MD,
      childMarkdown,
      EOL_MD,
    ].join("");
  }

  // Image
  if (block.type == "image") {
    const imageUrl =
      block.image.type == "external"
        ? block.image.external.url
        : block.image.file.url;
    return `${EOL_MD}![${blockToString(
      block.image.caption
    )}](${imageUrl})${EOL_MD}`;
  }

  // Audio
  if (block.type == "audio") {
    const audioUrl =
      block.audio.type == "external"
        ? block.audio.external.url
        : block.audio.file.url;
    return [
      EOL_MD,
      "<audio controls>",
      `<source src="${audioUrl}" />`,
      "</audio>",
      EOL_MD,
    ].join("");
  }

  // Video
  if (block.type == "video" && block.video.type == "external") {
    return [EOL_MD, block.video.external.url, EOL_MD].join("");
  }

  // Embed
  if (block.type == "embed") {
    const twitterEmbedRegex = /^https\:\/\/twitter\.com\/(.+?)\/status\/(?<id>\d+)[\?,$]?/;
    const match = twitterEmbedRegex.exec(block.embed.url);
    if (!match) return [EOL_MD, block.embed.url, EOL_MD].join("");

    return [
      EOL_MD,
      `<TwitterTweetEmbed tweetId="${match.groups["id"]}" />`,
      EOL_MD,
    ].join("");
  }

  // Quote
  if (block.type == "quote") {
    return [EOL_MD, prependToLines(markdown, ">", false), EOL_MD].join("");
  }

  // Bookmark
  if (block.type == "bookmark") {
    const bookmarkUrl = block.bookmark.url;
    const bookmarkCaption =
      blockToString(block.bookmark.caption) || bookmarkUrl;
    return `${EOL_MD}[${bookmarkCaption}](${bookmarkUrl})${EOL_MD}`;
  }

  // Divider
  if (block.type == "divider") {
    return `${EOL_MD}---${EOL_MD}`;
  }

  // Column List
  if (block.type == "column_list") {
    return [
      EOL_MD,
      "<ColumnList>",
      EOL_MD,
      markdown,
      EOL_MD,
      "</ColumnList>",
      EOL_MD,
    ].join("");
  }

  // Column
  if (block.type == "column") {
    return [
      "<Column>",
      EOL_MD,
      EOL_MD,
      markdown,
      EOL_MD,
      EOL_MD,
      "</Column>",
      EOL_MD,
    ].join("");
  }

  // Unsupported types.
  // TODO: Add support for callouts, internal video, and files
  return [
    EOL_MD,
    `<!-- This block type '${block.type}' is not supported yet. -->`,
    EOL_MD,
  ].join("");
};

//#endregion

//#region resolve images

const imageRegex =
  /!\[(?<alt>.*?)\]\((?<url>https:\/\/s3\.us\-west\-2\.amazonaws\.com\/secure\.notion\-static\.com\/(?<blockId>[\w\d]{8}\-[\w\d]{4}\-[\w\d]{4}\-[\w\d]{4}\-[\w\d]{12})\/(?<fileName>.+)\?.+)\)/gm;

const replaceImages = async (markdown, destDir) => {
  let match;
  let resultMarkdown = markdown;

  while ((match = imageRegex.exec(markdown))) {
    const url = match.groups.url;
    const alt = match.groups.alt;
    const blockId = match.groups.blockId;
    const fileName = match.groups.fileName;

    const destFileName = path.join(destDir, blockId, fileName);

    if (!(await fs.pathExists(path.dirname(destFileName)))) {
      await fs.mkdirs(path.dirname(destFileName));
    }

    var fileStream = fs.createWriteStream(destFileName);
    const response = await fetch(url);
    await Readable.fromWeb(response.body).pipe(fileStream);

    resultMarkdown = resultMarkdown.replace(
      match[0],
      `![${alt}](./${blockId}/${fileName})`
    );
  }

  return resultMarkdown;
};

//#endregion

getPages().then((pages) => {
  console.log(`found ${pages.length} pages`);

  if (pages.length > 0) {
    console.log(`processing pages:`);
  }

  pages.forEach(async (page) => {
    const title = getPageTitle(page);
    const properties = getPageProperties(page);

    const frontmatter = Object.keys(properties).reduce(
      (acc, key) => ({
        ...acc,
        [key]: properties[key].value.remoteImage || properties[key].value,
      }),
      { title }
    );
    if (frontmatter.status !== "Published") {
      return;
    }

    let markdown = blockToMarkdown(page, true);

    markdown = "---\n"
      .concat(YAML.stringify(frontmatter))
      .concat("\n---\n\n")
      .concat(markdown);

    const destDir = path.join(config.outputDir, `${page.id}`);

    try {
      if (!(await fs.pathExists(destDir))) {
        await fs.mkdirs(destDir);
      }

      markdown = await replaceImages(markdown, destDir);

      await fs.writeFile(path.join(destDir, "index.mdx"), markdown, "utf8");
      
      console.log(` - ${path.join(destDir, "index.mdx")}`);
    } catch (e) {
      console.error(e);
    }
  });
});

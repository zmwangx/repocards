const child_process = require("child_process");
const fs = require("fs").promises;
const path = require("path");

const glob = require("glob");
const Mustache = require("mustache");
const puppeteer = require("puppeteer");

const api = require("./api");

const templatesDir = path.join(__dirname, "templates");
const cardHTMLPath = path.join(templatesDir, "card.html");
const frameworksCSSPath = path.join(
  templatesDir,
  "frameworks-a1b48af6102ccb92f5490b71096b404b.css"
);
const githubCSSPath = path.join(
  templatesDir,
  "github-536f87adf120294bb4c70c32cb21f032.css"
);
const galleryHTMLPath = path.join(templatesDir, "gallery.html");

// Generate images into docs/ for GitHub Pages.
const generatedDir = path.join(__dirname, "docs");

// Use iPhone SE viewport.
const viewport = {
  width: 320,
  height: 568,
  deviceScaleFactor: 2,
};

const spawnPromise = (command, args, options) => {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(command, args, options);
    proc.on("error", reject);
    proc.on("close", code => {
      if (code === 0) {
        resolve(proc);
      } else {
        reject({
          message: `${command} exited with code ${code}`,
          code,
          process: proc,
        });
      }
    });
  });
};

// In order to check how GitHub formats a particular count, check the advanced
// search results for a particular star count, e.g.
// https://github.com/search?q=stars%3A999..999&type=Repositories
const formatCount = count => {
  if (count < 1000) {
    return `${count}`;
  }
  const hundreds = Math.round(count / 100);
  const result = `${hundreds / 10}k`;
  if (result.length < 6) {
    return result;
  } else {
    // e.g. 100.1k, need to drop the decimal part.
    return `${(hundreds / 10).toFixed(0)}k`;
  }
};

(async () => {
  const data = await api.getdata();
  if (data === null) {
    process.exit(1);
  }

  // Remove existing card images and corresponding directories.
  for (const card of glob.sync(path.join(generatedDir, "**/*.png"))) {
    await fs.unlink(card);
  }
  for (const dir of glob.sync(path.join(generatedDir, "*/"))) {
    try {
      await fs.rmdir(dir);
    } catch (err) {
      if (err.code === undefined || err.code != "ENOTEMPTY") {
        console.error(err);
      }
    }
  }

  const cardHTML = await fs.readFile(cardHTMLPath, "utf8");
  const frameworksCSS = await fs.readFile(frameworksCSSPath, "utf8");
  const githubCSS = await fs.readFile(githubCSSPath, "utf8");
  const galleryHTML = await fs.readFile(galleryHTMLPath, "utf8");

  const browser = await puppeteer.launch({
    // I know! Use root with discretion.
    args: [...(process.getuid() === 0 ? ["--no-sandbox"] : [])],
  });
  const screenshotPaths = [];
  await fs.mkdir(generatedDir, { recursive: true });
  for (const repository of data.viewer.repositories.nodes) {
    // Skip all repos under an organization. The API call could return repos
    // from organizations where membership is private, and at the moment I've
    // found no way to tell whether the organization membership is public or
    // not, so I'll have to skip them all.
    //
    // Select repos can be reenabled through whitelisting, though that's not
    // needed at the moment, hence left unimplemented.
    if (repository.owner.viewerIsAMember !== undefined) {
      continue;
    }
    const content = Mustache.render(
      cardHTML,
      {
        name: repository.name,
        owner:
          repository.owner.login === data.viewer.login
            ? null
            : repository.owner.login,
        // Strip enclosing <div></div> so that the description could fit in a
        // <p></p>.
        descriptionHTML: repository.descriptionHTML.replace(
          /^\s*<div>(.*)<\/div>\s*$/s,
          "$1"
        ),
        language: repository.primaryLanguage,
        starCount: repository.stargazers.totalCount,
        starCountStr: formatCount(repository.stargazers.totalCount),
        forkCount: repository.forkCount,
        forkCountStr: formatCount(repository.forkCount),
      },
      {
        frameworksCSS,
        githubCSS,
      }
    );
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setContent(content);
    const element = await page.$("body > div");
    let screenshotPath;
    if (repository.owner.login === data.viewer.login) {
      screenshotPath = path.join(generatedDir, `${repository.name}.png`);
    } else {
      screenshotPath = path.join(
        generatedDir,
        `${repository.nameWithOwner}.png`
      );
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    }
    screenshotPaths.push(screenshotPath);
    console.log(
      `${repository.nameWithOwner}: ${path.relative("", screenshotPath)}`
    );
    await element.screenshot({ path: screenshotPath, omitBackground: true });
    await page.close();
  }
  await browser.close();

  try {
    await spawnPromise("optipng", screenshotPaths, {
      stdio: ["ignore", 1, 2], // inherit stdout & stderr, attach /dev/null as stdin
    });
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  }

  const galleryHTMLRendered = Mustache.render(galleryHTML, {
    images: screenshotPaths.map(screenshotPath => ({
      url: path.relative(generatedDir, screenshotPath),
    })),
  });
  await fs.writeFile(
    path.join(generatedDir, "gallery.html"),
    galleryHTMLRendered
  );
})();

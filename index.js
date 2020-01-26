const puppeteer = require('puppeteer');
const fs = require('fs-extra');

void async function () {
  const browser = await puppeteer.launch({ headless: false });
  const [page] = await browser.pages();
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');

  // Keep scrolling down until the "# Comments" header appears
  // TODO: Add also a counter to limit the maximum number of attempts (to like 10?)
  while (await page.$('.count-text.ytd-comments-header-renderer') === null) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    try {
      await page.waitForSelector('.count-text.ytd-comments-header-renderer', { timeout: 1000 });
      break;
    }
    catch (error) {
      // Take the absense of the element to mean we haven't reach the bottom yet
    }
  }

  await fs.writeFile('comments.json', '[\n');

  let commentCount = 0;
  while (true) {
    const allElements = await page.$$('ytd-comment-renderer #content-text');

    // Wait until more scrolling reveals new comments
    if (allElements.length > commentCount) {
      const newElements = allElements.slice(commentCount);

      // Pull the comments texts from the comment elements
      const comments = await Promise.all(newElements.map(e => e.evaluate(e2 => e2.textContent)));
      console.log('Collected', newElements.length, 'new comments');

      commentCount += comments.length;
      await fs.appendFile('comments.json', JSON.stringify(comments, null, 2).slice(1, -1) /* Trim `[` and `]` */ + ',\n');
    }

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    try {
      await page.waitForSelector('ytd-comments #continuations yt-next-continuation');
      //console.log('Loading new comments…');
      await page.waitForSelector('ytd-comments #continuations yt-next-continuation', { visible: false });
      //console.log('Loaded new comments');
    }
    catch (error) {
      // Take the absense of the element to mean there's no more comments
      console.log('Collected all comments');
      break;
    }
  }

  await browser.close();
}()

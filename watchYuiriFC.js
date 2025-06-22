import fetch from 'node-fetch';
import fs from 'fs/promises';

const WEBHOOKS = {
  news: 'https://api.pushcut.io/RTj19Idh6CLyKAkFMA2d5/notifications/fc_news_update',
  blogs: 'https://api.pushcut.io/RTj19Idh6CLyKAkFMA2d5/notifications/fc_blogs_update',
  photos_movies: 'https://api.pushcut.io/RTj19Idh6CLyKAkFMA2d5/notifications/fc_photos_movies_update',
};

const PAGES = {
  news: 'https://murayamayuiri-fc.jp/news/all/pages/1',
  blogs: 'https://murayamayuiri-fc.jp/blogs/all/pages/1',
  photos: 'https://murayamayuiri-fc.jp/photos/all/pages/1',
  movies: 'https://murayamayuiri-fc.jp/movies/all/pages/1',
};

const CACHE_DIR = './cache';

// HTMLタグと不要文字を削除
function stripHtmlTags(str) {
  if (!str) return '';
  return str.replace(/<style[\s\S]*?<\/style>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/NEW/g, '')
            .trim();
}

// news, photos, movies用タイトル取得
async function fetchLatestTitle(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  // 最新記事のタイトルらしきpタグから取得
  const match = html.match(/<a href="\/[^"]+" class="css-13o7eu2">[\s\S]*?<p class="chakra-text css-[^"]+">([^<]+)<\/p>/);
  if (!match) return null;
  return stripHtmlTags(match[1]);
}

// blogs用タイトル取得（<h2>タグのタイトルを取得）
async function fetchLatestBlogTitle(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const match = html.match(/<h2 class="chakra-text css-[^"]+">([^<]+)<\/h2>/);
  if (!match) return null;
  return match[1].trim();
}

async function readCache(name) {
  try {
    return await fs.readFile(`${CACHE_DIR}/${name}.txt`, 'utf8');
  } catch {
    return null;
  }
}

async function writeCache(name, data) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(`${CACHE_DIR}/${name}.txt`, data);
}

async function notify(name, message) {
  const url = WEBHOOKS[name];
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // 無料プラン対応で空送信
  });
  console.log(`[${name}] 通知送信: ${message}`);
}

async function checkAndNotify() {
  const updates = {};

  // news
  const latestNews = await fetchLatestTitle(PAGES.news);
  const cacheNews = await readCache('news');
  if (latestNews && latestNews !== cacheNews) {
    await writeCache('news', latestNews);
    updates.news = latestNews;
  }

  // blogs
  const latestBlogs = await fetchLatestBlogTitle(PAGES.blogs);
  const cacheBlogs = await readCache('blogs');
  if (latestBlogs && latestBlogs !== cacheBlogs) {
    await writeCache('blogs', latestBlogs);
    updates.blogs = latestBlogs;
  }

  // photos & movies
  const latestPhotos = await fetchLatestTitle(PAGES.photos);
  const latestMovies = await fetchLatestTitle(PAGES.movies);
  const cachePhotos = await readCache('photos');
  const cacheMovies = await readCache('movies');

  let photosMoviesUpdated = false;

  if (latestPhotos && latestPhotos !== cachePhotos) {
    await writeCache('photos', latestPhotos);
    photosMoviesUpdated = true;
  }
  if (latestMovies && latestMovies !== cacheMovies) {
    await writeCache('movies', latestMovies);
    photosMoviesUpdated = true;
  }
  if (photosMoviesUpdated) {
    updates.photos_movies = '写真または動画に更新あり';
  }

  // 通知送信
  for (const [key, val] of Object.entries(updates)) {
    await notify(key, val);
  }

  if (Object.keys(updates).length === 0) {
    console.log('更新なし');
  }
}

checkAndNotify().catch(console.error);
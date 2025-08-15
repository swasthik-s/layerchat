import { NextRequest, NextResponse } from 'next/server';

interface Metadata {
  title: string;
  description: string;
  favicon: string;
  domain: string;
  image?: string;
}

// Cache for metadata to avoid repeated requests
const metadataCache = new Map<string, { data: Metadata; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Check cache first
    const cached = metadataCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Fetch metadata from the URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const metadata = extractMetadata(html, validUrl);
      
      // Cache the result
      metadataCache.set(url, { data: metadata, timestamp: Date.now() });
      
      return NextResponse.json(metadata);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Failed to fetch metadata for', url, error);
      
      // Fallback metadata
      const fallbackMetadata: Metadata = {
        title: validUrl.pathname.split('/').pop()?.replace(/[-_]/g, ' ') || 'Article',
        description: 'Click to visit source and read the full article',
        favicon: `https://www.google.com/s2/favicons?domain=${validUrl.hostname}&sz=16`,
        domain: validUrl.hostname.replace('www.', ''),
      };
      
      return NextResponse.json(fallbackMetadata);
    }
  } catch (error) {
    console.error('Metadata API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function extractMetadata(html: string, url: URL): Metadata {
  const domain = url.hostname.replace('www.', '');
  
  // Extract title - prefer Open Graph, fallback to title tag
  let title = '';
  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"[^>]*>/i);
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const twitterTitleMatch = html.match(/<meta\s+name="twitter:title"\s+content="([^"]*)"[^>]*>/i);
  
  title = ogTitleMatch?.[1] || twitterTitleMatch?.[1] || titleMatch?.[1] || '';
  title = title.trim().replace(/\s+/g, ' ');
  
  // Extract description - prefer Open Graph, fallback to meta description
  let description = '';
  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"[^>]*>/i);
  const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"[^>]*>/i);
  const twitterDescMatch = html.match(/<meta\s+name="twitter:description"\s+content="([^"]*)"[^>]*>/i);
  
  description = ogDescMatch?.[1] || twitterDescMatch?.[1] || metaDescMatch?.[1] || '';
  description = description.trim().replace(/\s+/g, ' ');
  
  // Detect if this is a category/topic page and enhance accordingly
  const isCategory = url.pathname.includes('/category/') || 
                    url.pathname.includes('/tag/') || 
                    url.pathname.includes('/topic/') ||
                    url.pathname.includes('/categories/');
  
  if (isCategory) {
    if (!description) {
      // Enhanced descriptions for category pages
      if (domain.includes('techcrunch.com')) {
        description = 'Latest technology news, startup coverage, and industry insights from TechCrunch';
      } else if (domain.includes('wsj.com')) {
        description = 'Business and financial news analysis from The Wall Street Journal';
      } else if (domain.includes('mit.edu')) {
        description = 'Research breakthroughs and technological advances from MIT';
      } else if (domain.includes('artificialintelligence-news.com')) {
        description = 'Latest artificial intelligence news, analysis, and industry developments';
      } else if (domain.includes('reuters.com')) {
        description = 'Breaking news and trusted journalism from Reuters';
      } else {
        description = `Latest news and updates from ${domain}`;
      }
    }
    
    // Enhance category page titles
    if (!title || title.length < 10) {
      const pathParts = url.pathname.split('/').filter(p => p);
      const category = pathParts[pathParts.length - 1]?.replace(/-/g, ' ') || '';
      title = `${category} - ${domain}`.replace(/^\s*-\s*/, '');
    }
  }
  
  // Extract favicon - try multiple sources
  let favicon = '';
  const faviconMatches = [
    html.match(/<link[^>]+rel="icon"[^>]+href="([^"]*)"[^>]*>/i),
    html.match(/<link[^>]+href="([^"]*)"[^>]+rel="icon"[^>]*>/i),
    html.match(/<link[^>]+rel="shortcut icon"[^>]+href="([^"]*)"[^>]*>/i),
    html.match(/<link[^>]+href="([^"]*)"[^>]+rel="shortcut icon"[^>]*>/i),
  ];
  
  const faviconMatch = faviconMatches.find(match => match);
  if (faviconMatch?.[1]) {
    const faviconUrl = faviconMatch[1];
    if (faviconUrl.startsWith('http')) {
      favicon = faviconUrl;
    } else if (faviconUrl.startsWith('//')) {
      favicon = url.protocol + faviconUrl;
    } else if (faviconUrl.startsWith('/')) {
      favicon = `${url.protocol}//${url.hostname}${faviconUrl}`;
    } else {
      favicon = `${url.protocol}//${url.hostname}/${faviconUrl}`;
    }
  } else {
    // Fallback to Google's favicon service
    favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  }
  
  // Extract Open Graph image
  let image = '';
  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"[^>]*>/i);
  const twitterImageMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]*)"[^>]*>/i);
  
  const imageUrl = ogImageMatch?.[1] || twitterImageMatch?.[1] || '';
  if (imageUrl) {
    if (imageUrl.startsWith('http')) {
      image = imageUrl;
    } else if (imageUrl.startsWith('//')) {
      image = url.protocol + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      image = `${url.protocol}//${url.hostname}${imageUrl}`;
    }
  }
  
  // Clean up and validate
  if (!title) {
    title = url.pathname.split('/').pop()?.replace(/[-_]/g, ' ') || 'Article';
  }
  
  if (!description) {
    description = 'Click to visit source and read the full article';
  }
  
  // Decode HTML entities
  const decodeHtml = (str: string) => str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
  
  return {
    title: decodeHtml(title),
    description: decodeHtml(description),
    favicon,
    domain,
    image,
  };
}

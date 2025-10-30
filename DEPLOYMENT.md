# Vercel Deployment & Environment Variables Setup

## GitHub Repository Setup

### Option 1: Using GitHub CLI (if installed)
```bash
gh repo create landlord-app --public --source=. --remote=origin --push
```

### Option 2: Manual Setup
1. Go to https://github.com/new
2. Create a new repository named `landlord-app` (or your preferred name)
3. Don't initialize with README, .gitignore, or license (we already have these)
4. Run these commands:

```bash
git remote add origin https://github.com/YOUR_USERNAME/landlord-app.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## Vercel Deployment

### 1. Connect Repository to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository (`landlord-app`)
3. Vercel will auto-detect Next.js settings

### 2. Configure Environment Variables in Vercel

In the Vercel dashboard, go to your project → Settings → Environment Variables and add:

#### Required Variables:
```
RENTCAST_API_KEY=your_rentcast_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

#### Optional Variables:
```
APP_URL=https://your-app.vercel.app
MAPBOX_TOKEN=your_mapbox_token  # Optional - for better geocoding
DECODER_MODEL=gpt-4o-mini  # Optional - defaults to gpt-4o-mini
FEATURE_SCRAPE_FALLBACK=false
FEATURE_VISION_PASS=false
```

### 3. Deploy
- Vercel will automatically deploy on push to main
- Or click "Deploy" in the dashboard

### 4. Pull Environment Variables Locally (Optional)

If you want to pull env vars from Vercel to your local `.env.local`:

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Pull environment variables
vercel env pull .env.local
```

This will create a `.env.local` file with all your Vercel environment variables.

## Project Structure Ready for Vercel

✅ Next.js 16 App Router
✅ API Routes configured
✅ Server Components
✅ Proper caching setup
✅ TypeScript configured
✅ Tailwind CSS configured

## Next Steps After Deployment

1. Test the deployed app
2. Verify environment variables are working
3. Test the decode flow end-to-end
4. Monitor Vercel logs for any issues


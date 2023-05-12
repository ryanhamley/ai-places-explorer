# AI Places Explorer

The AI Places Explorer is a proof-of-concept that combines ChatGPT, Foursquare's Places API and Mapbox GL JS
to allow users to ask in natural language about various places which are then displayed on a map along with 
information about them.

### Using AI Places Explorer

Clone this repository:

```
git clone git@github.com:ryanhamley/ai-places-explorer.git
```

Install the dependencies (Note: You should be on Node 18 for optimal results):

```
npm install
```

Fill out `.env.template` with your OpenAI API key, FSQ api key and Mapbox GL JS access token, then rename 
the file to `.env`.

Start the development server:

```
npm run dev
```

The app will be running at [http://localhost:1234/](http://localhost:1234/).
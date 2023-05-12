import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import scrollama from "scrollama";
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const overlay = document.getElementById("overlay");
const promptForm = document.getElementById("prompt-form");
const promptInput = document.getElementById("prompt");
const submitButton = document.getElementById("submitBtn");
const loadingScreen = document.querySelector('#overlay span');
const loadingText = document.getElementById('loading-text');
const featuresContainer = document.getElementById("features");
const modal = document.getElementById('modal-js-example');
const modalContent = document.querySelector('.modal-content .box');
const modalBackground = document.querySelector('.modal-background');
modalBackground.addEventListener('click', () => {
    modal.classList.remove('is-active');
    modalContent.innerHTML = null;
});

let marker = new mapboxgl.Marker();
let openaiData = [];

const cachedLongerDescriptions = {};

submitButton.addEventListener('click', () => {
    const prompt = promptInput.value;
    if (prompt) {
        const formattedPrompt = formatPrompt(prompt);
        promptForm.style.display = 'none';
        loadingScreen.style.display = 'block';
        submitPrompt(formattedPrompt);
    }
});

const formatPrompt = (prompt) => {
    if (prompt.charAt(prompt.length - 1) !== '?') {
        prompt += '?';
    }

    return `${prompt} Format the answer as JSON with the following properties: "name", "localName", "address", "city", "cc", "latitude", "longitude" and "description". The "localName" property should be "name" in the language of the location's country. The "cc" property should be the two-digit country code.`
};

const submitPrompt = async (prompt) => {
    try {
        const response = await openai.createCompletion({
          model: "text-davinci-003",
          prompt,
          temperature: 0,
          max_tokens: 1000,
        });
        loadingText.innerText = 'Building map...';
        openaiData = JSON.parse(response.data.choices[0].text);
        for(let i = 0; i < openaiData.length; i++) {
            const feature = openaiData[i];
            const photoURL = await getPhotoUrl(feature);
            createFeatures(feature, i, photoURL);
        };
        initMap([openaiData[0].longitude, openaiData[0].latitude])
        overlay.style.display = 'none';
    } catch (error) {
        // TODO show an error screen
        if (error.response) {
            console.log(error.response.status);
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
};

const getPhotoUrl = async (feature) => {
    const fsqPlace = await getFSQPlacesMatch(feature);
    let photoURL;
    if (fsqPlace.place) {
        photoURL = await getFSQPhotoURL(fsqPlace.place.fsq_id);
    }
    return photoURL || 'https://bulma.io/images/placeholders/1280x960.png';
}

const initMap = (center) => {
    mapboxgl.accessToken = process.env.MAPBOX_ACCESS_TOKEN;
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center,
        zoom: 16,
        pitch: 60,
        transformRequest: (url) => {
            const hasQuery = url.indexOf("?") !== -1;
            const suffix = hasQuery ? "&pluginName=scrollytellingV2" : "?pluginName=scrollytellingV2";
            return {
              url: url + suffix
            }
        },
        interactive: false
    });

    map.on('load', () => {
        initScroll(map);
        marker.setLngLat(center).addTo(map);
    });
};

const initScroll = (map) => {
    var scroller = scrollama();

    scroller
    .setup({
        step: '.step',
        offset: 0.5,
        progress: true
    })
    .onStepEnter(response => {
        const element = response.element;
        const location = openaiData[response.index];
        const center = [location.longitude, location.latitude];
        element.classList.add('active');
        map.flyTo({center})
        marker.setLngLat(center);
    })
    .onStepExit(response => {
        response.element.classList.remove('active');
    });
}

const createFeatures = (feature, idx, photoUrl) => {
    const fragment = new DocumentFragment();
    const card = createCard(feature, idx, photoUrl);
    fragment.appendChild(card);
    featuresContainer.appendChild(fragment);
};

const basePlacesAPIUrl = 'https://api.foursquare.com/v3/places';

const getFSQPlacesMatch = async (feature) => {
    const fsqMatchURL = `${basePlacesAPIUrl}/match`;
    const queryString = `?name=${encodeURIComponent(feature.name)}&address=${encodeURIComponent(feature.address)}&city=${encodeURIComponent(feature.city)}&cc=${feature.cc}`;
    const queryPlacesAPIUrl = `${fsqMatchURL}${queryString}`;
    const placesData = await fetchFSQData(queryPlacesAPIUrl);
    return placesData;
}

const getFSQPhotoURL = async (id) => {
    const fsqPhotoUrl = `${basePlacesAPIUrl}/${id}/photos`;
    const photoData = await fetchFSQData(fsqPhotoUrl);
    if (!photoData) return;
    const photo = photoData[0];
    return `${photo.prefix}original${photo.suffix}`;
}

const fetchFSQData = async (url) => {
    try {
        const fsqPlacesResponse = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": process.env.FSQ_API_KEY
            }
        });
    
        const data = await fsqPlacesResponse.json();
        return data;
    } catch (error) {
        console.log(`Failed to fetch ${url}:`, error);
    }
}

const fetchLongerDescription = async (e) => {
    const footerContent = e.srcElement;
    const footer = footerContent.parentElement;
    const footerProgressBar = footer.lastChild;
    footerContent.style.display = 'none';
    footerProgressBar.style.display = 'block';
    const name = footer.dataset.name;
    let text = '';
    if (cachedLongerDescriptions[name]) {
        text = cachedLongerDescriptions[name];
    } else {
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: `Tell me more about ${name}`,
            temperature: 0,
            max_tokens: 2000
        });
        text = response.data.choices[0].text.trim();
        cachedLongerDescriptions[name] = text;
    }
    footerContent.style.display = 'block';
    footerProgressBar.style.display = 'none';
    modal.classList.add('is-active');
    const p = document.createElement('p');
    p.innerText = text;
    modalContent.appendChild(p);
}

const createCard = (feature, idx, photoUrl) => {
    const card = document.createElement('div');
    card.classList.add('card', 'step', 'lefty', 'has-text-centered');
    if (idx === 0) card.classList.add('active');
    card.id = `card-${idx}`;

    const cardImage = document.createElement('div');
    cardImage.classList.add('card-image');

    const figure = document.createElement('figure');
    figure.classList.add('image', 'is-4by3');

    const image = document.createElement('img');
    image.src = photoUrl;
    image.alt = 'Placeholder text';

    figure.appendChild(image);
    cardImage.appendChild(figure);

    const cardContent = document.createElement('div');
    cardContent.classList.add('card-content');

    const title = document.createElement('p');
    title.classList.add('title');
    title.innerText = feature.name;

    const content = document.createElement('div');
    content.classList.add('content');
    content.innerHTML = feature.description;

    cardContent.appendChild(title);
    cardContent.appendChild(content);

    const footer = document.createElement('div');
    footer.setAttribute('data-name', feature.name);
    footer.classList.add('card-footer');
    footer.style.cursor = 'pointer';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'center';
    
    const footerContent = document.createElement('p');
    footerContent.classList.add('card-footer-item');
    footerContent.innerText = `Click here to learn more about ${feature.name}`;
    footerContent.addEventListener('click', fetchLongerDescription);

    const footerProgressBar = document.createElement('progress');
    footerProgressBar.classList.add('progress', 'is-large', 'is-info');
    footerProgressBar.setAttribute('max', 100);
    footerProgressBar.innerText = '60%';
    footerProgressBar.style.display = 'none';
    footerProgressBar.style.maxWidth = '50%';

    footer.appendChild(footerContent);
    footer.appendChild(footerProgressBar);

    card.appendChild(cardImage);
    card.appendChild(cardContent);
    card.appendChild(footer);

    return card;
};
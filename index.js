import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import scrollama from "scrollama";
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: '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',
});
const openai = new OpenAIApi(configuration);

const overlay = document.getElementById("overlay");
const promptForm = document.getElementById("prompt-form");
const promptInput = document.getElementById("prompt");
const submitButton = document.getElementById("submitBtn");
const progressBar = document.querySelector('.progress');
progressBar.style.display = 'none';
const featuresContainer = document.getElementById("features");

let marker = new mapboxgl.Marker();

const dummyData = [
    {
        "name": "Clerigos Tower",
        "localName": "Torre dos Clérigos",
        "address": "R. de São Filipe de Nery, 4050-546 Porto, Portugal",
        "latitude": 41.145086,
        "longitude": -8.611862,
        "description": "The Clérigos Tower is a Baroque bell tower in the city of Porto, in Portugal. It is one of the most prominent symbols of the city and is classified as a National Monument."
    },
    {
        "name": "Livraria Lello",
        "localName": "Livraria Lello",
        "address": "R. das Carmelitas, 144, 4050-161 Porto, Portugal",
        "latitude": 41.147719,
        "longitude": -8.609945,
        "description": "Livraria Lello is a bookstore located in Porto, Portugal. It is one of the oldest bookstores in the world and is considered one of the most beautiful bookstores in the world."
    },
    {
        "name": "Porto Cathedral",
        "localName": "Sé do Porto",
        "address": "Largo da Sé, 4050-573 Porto, Portugal",
        "latitude": 41.144541,
        "longitude": -8.611862,
        "description": "The Porto Cathedral is a Roman Catholic church located in the historical center of Porto, Portugal. It is one of the city's oldest monuments and a major tourist attraction."
    },
    {
        "name": "Cais da Ribeira",
        "localName": "Cais da Ribeira",
        "address": "R. da Ribeira, 4050-513 Porto, Portugal",
        "latitude": 41.140045,
        "longitude": -8.611862,
        "description": "Cais da Ribeira is a waterfront area in the city of Porto, Portugal. It is a popular tourist destination and is known for its colorful buildings, cobblestone streets, and picturesque views of the Douro River."
    },
    {
        "name": "Palácio da Bolsa",
        "localName": "Palácio da Bolsa",
        "address": "R. Ferreira Borges, 4050-253 Porto, Portugal",
        "latitude": 41.145086,
        "longitude": -8.611862,
        "description": "The Palácio da Bolsa is a historic building in the city of Porto, Portugal. It was built in the 19th century and is now a museum and a major tourist attraction in the city."
    }
];

submitButton.addEventListener('click', () => {
    const prompt = promptInput.value;
    if (prompt) {
        const formattedPrompt = formatPrompt(prompt);
        promptForm.style.display = 'none';
        progressBar.style.display = 'block';
        submitPrompt(formattedPrompt);
    }
});

const formatPrompt = (prompt) => {
    if (prompt.charAt(prompt.length - 1) !== '?') {
        prompt += '?';
    }

    return `${prompt} Format the answer as JSON with the following properties: "name", "localName", "address", "latitude", "longitude" and "description". The "localName" property should be "name" in the local language.`
};

const submitPrompt = async (prompt) => {
    try {
        // const response = await openai.createCompletion({
        //   model: "text-davinci-003",
        //   prompt,
        //   temperature: 0,
        //   max_tokens: 1000,
        // });
        // console.log(response);
        
        const fsqPlace = await getFSQPlacesMatch(dummyData[0]);
        console.log('fsqData', fsqPlace);
        const photoURL = await getFSQPhotoURL(fsqPlace.place.fsq_id);
        console.log(photoURL);
        createFeatures(dummyData, photoURL);
        initMap([dummyData[0].longitude, dummyData[0].latitude])
        overlay.style.display = 'none';
        // console.log(response.data.choices[0].text)
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

const initMap = (center) => {
    mapboxgl.accessToken = 'pk.eyJ1IjoiZm91cnNxdWFyZSIsImEiOiJjRGRqOVZZIn0.rMLhJeqI_4VnU2YdIJvD3Q';
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
    .onStepEnter(async response => {
        const element = response.element;
        const location = dummyData[response.index];
        const center = [location.longitude, location.latitude];
        element.classList.add('active');
        map.flyTo({center})
        marker.setLngLat(center);
    })
    .onStepExit(response => {
        response.element.classList.remove('active');
    });
}

const createFeatures = (features, photoUrl) => {
    const fragment = new DocumentFragment();

    features.forEach((feature, idx) => {
        const card = createCard(feature, idx, photoUrl);
        console.log('card', card);

        fragment.appendChild(card);
    });

    featuresContainer.appendChild(fragment);
};

const basePlacesAPIUrl = 'https://api.foursquare.com/v3/places';

const getFSQPlacesMatch = async (feature) => {
    const fsqMatchURL = `${basePlacesAPIUrl}/match`;
    const queryString = `?name=${encodeURIComponent(feature.localName)}&address=${encodeURIComponent(feature.address)}&city=Porto&cc=PT`;
    const queryPlacesAPIUrl = `${fsqMatchURL}${queryString}`;
    const placesData = await fetchFSQData(queryPlacesAPIUrl);
    return placesData;
}

const getFSQPhotoURL = async (id) => {
    const fsqPhotoUrl = `${basePlacesAPIUrl}/${id}/photos`;
    const photoData = await fetchFSQData(fsqPhotoUrl);
    const photo = photoData[0];
    return `${photo.prefix}original${photo.suffix}`;
}

const fetchFSQData = async (url) => {
    const fsqPlacesResponse = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "fsq3riMMk8S7FMiCwXUnMQ9ivSjXd53q0pGHwOF22UYLeno="
        }
    });

    const data = await fsqPlacesResponse.json();
    return data;
}

const fetchLongerDescription = async (e) => {
    console.log('longer description', e);
    console.log('src', e.srcElement.dataset)
    console.log('parent', e.srcElement.parentElement.dataset);
    const name = e.srcElement.dataset.name || e.srcElement.parentElement.dataset.name;
    const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: `Tell me more about ${name}`,
        temperature: 0,
        max_tokens: 1000
    });
    console.log('response', response);
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
    image.src = idx === 0 ? photoUrl : 'https://bulma.io/images/placeholders/1280x960.png';
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
    
    const footerContent = document.createElement('p');
    footerContent.classList.add('card-footer-item');
    footerContent.innerText = `Click here to learn more about ${feature.name}`;

    footer.appendChild(footerContent);
    footer.addEventListener('click', fetchLongerDescription);

    card.appendChild(cardImage);
    card.appendChild(cardContent);
    card.appendChild(footer);

    return card;
};
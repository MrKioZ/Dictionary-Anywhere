const GOOGLE_SPEECH_URI = 'https://www.google.com/speech-api/v1/synthesize',
    DEFAULT_HISTORY_SETTING = {
        enabled: true
    };

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { word, lang } = request, 
        url = `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${word}`;

    try {
        fetch(url, { 
            method: 'GET',
            credentials: 'omit'
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) {
                        return { isError: true, status: 404 }; // Return a sentinel object instead of undefined
                    }
                    // Optionally handle other statuses
                    return { isError: true, status: response.status };
                }
                return response.json(); // Only parse JSON if response is OK
            })
            .then(data => {
                // Handle error case from the first .then
                if (data && data.isError) {
                    if (data.status === 404) {
                        return sendResponse({});
                    }
                    // Optionally handle other errors
                    return sendResponse({});
                }
        
                // At this point, data is the parsed JSON (array) from a successful response
                const [result] = data; // Destructure the first item from the array
        
                if (result && result.title === 'No Definitions Found') {
                    return sendResponse({ content: {} });
                }
        
                const { word, phonetic, phonetics, meanings, license, sourceUrls } = result,
                    content = {
                        word,
                        phonetic,
                        audioSrc: phonetics[0] && phonetics[0].audio,
                        meaning: meanings[0].definitions[0].definition,
                        license,
                        sourceUrls
                    };
        
                sendResponse({ content });
        
                // Handle storage logic
                if (content) {
                    browser.storage.local.get().then((results) => {
                        let history = results.history || DEFAULT_HISTORY_SETTING;
                        if (history.enabled) {
                            saveWord(content);
                        }
                    });
                }
            })
            .catch(error => {
                // Catch any unexpected errors (e.g., network failure, invalid JSON)
                console.error('Fetch error:', error);
                sendResponse({});
            });
    } catch (error) {
        console.error('dictionary api error', error);
    }    
    return true;
});

function extractMeaning (document, context) {
    if (!document.querySelector("[data-dobid='hdw']")) { return null; }
    
    var word = document.querySelector("[data-dobid='hdw']").textContent,
        definitionDiv = document.querySelector("div[data-dobid='dfn']"),
        meaning = "";

    if (definitionDiv) {
        definitionDiv.querySelectorAll("span").forEach(function(span){
            if(!span.querySelector("sup"))
                 meaning = meaning + span.textContent;
        });
    }

    meaning = meaning[0].toUpperCase() + meaning.substring(1);

    var audio = document.querySelector("audio[jsname='QInZvb']"),
        source = document.querySelector("audio[jsname='QInZvb'] source"),
        audioSrc = source && source.getAttribute('src');

    if (audioSrc) {
        !audioSrc.includes("http") && (audioSrc = audioSrc.replace("//", "https://"));
    }
    else if (audio) {
        let exactWord = word.replace(/·/g, ''), // We do not want syllable seperator to be present.
            
        queryString = new URLSearchParams({
            text: exactWord, 
            enc: 'mpeg', 
            lang: context.lang, 
            speed: '0.4', 
            client: 'lr-language-tts', 
            use_google_only_voices: 1
        }).toString();

        audioSrc = `${GOOGLE_SPEECH_URI}?${queryString}`;
    }

    return { word: word, meaning: meaning, audioSrc: audioSrc };
};

function saveWord (content) {
    let word = content.word,
        meaning = content.meaning,
      
        storageItem = browser.storage.local.get('definitions');

        storageItem.then((results) => {
            let definitions = results.definitions || {};

            definitions[word] = meaning;
            browser.storage.local.set({
                definitions
            });
        })
}
#### 🚀 Web-Based Suno Music Studio: Advanced Track Generation with Custom Settings

This project demonstrates a web-based AI music studio powered by Suno and integrated via the kie.ai API. Users can generate instrumental or vocal tracks using Simple or Custom modes, controlling parameters like Style Weight, Weirdness, and Audio Weight. Tracks can include duets, hard rock, metal, piano meditation, or bilingual reggae, with multiple variations generated per request.

The app manages tracks with MongoDB and server-hosted audio files, supports search and deletion, and handles callbacks, debugging, and error management for reliable AI-driven music generation.

We are going to add more features later, including a web-based music app that will allow users to generate, extend, and customize music, create personas, produce covers, generate music videos, and manage tracks with advanced creative controls. A dashboard will let users organize and share their creations.

#### 🎤 Generating Persona
We implemented persona generation in [kie.ai](https://kie.ai/)  to give vocal tracks a unique musical identity. A persona defines the performer’s voice, tone, emotion, and delivery, as well as the overall style, mood, and instrumentation. Personas allow you to generate new tracks that feel like they belong to the same musical world, even if the vocals differ. Only vocal tracks can be used to create a persona, and each persona can be saved, edited, and reused for consistent music generation.

#### 🎶 Extending Music
We implemented music extension in [kie.ai](https://kie.ai/) to allow generated tracks to continue beyond their original length or evolve creatively. Extensions preserve the core genre, tempo, and musical identity while introducing new sections, arrangements, or energy. By using Custom Parameters, you can modify style, weights, and other settings for creative variation, or keep them off for a seamless continuation of the original track. Each extension can be generated as a separate track or physically appended to the original for a cohesive listening experience.
 
#### 🎶 Upload & Extend Music
We’ve added a new feature that lets you upload your own MP3 tracks and extend them directly from the server. The process uses an upload step followed by an extend step, with files hosted temporarily on the [kie.ai](https://kie.ai/)  server. This is especially useful for tracks that may no longer exist on the main server after 14 days, as your uploaded files remain accessible for extension unless manually deleted. By adjusting prompt, style, and weights, you can create creative extensions while keeping the core identity of your track intact.

#### 🎶 Upload & Cover Music
We’ve added a new feature that lets you upload your own MP3 tracks and cover them in a new style directly on the server. The process uses an upload step followed by a cover step, with files hosted temporarily on the [kie.ai](https://kie.ai/) server. Even if you modify the prompt and adjust the style, the cover preserves the track’s original melody and musical “DNA,” keeping its core identity intact while creating a fresh, stylistically transformed version.

#### 🎶 Add Instrumental
The Add Instrumental feature lets you transform your uploaded vocal or melody into a full instrumental track. Simply upload your MP3 vocal or melody, then set the title, tags, and weights to customize the result. The generated instrumental is created directly on the server, allowing you to instantly listen to the transformation. This is perfect for experimenting with new arrangements, remixing ideas, or quickly producing professional-sounding tracks without needing a producer.

#### 🎶 Add Vocals
The Add Vocals feature lets you generate and layer AI vocals on top of an existing instrumental track. Simply upload your MP3 instrumental, provide a prompt describing the lyrics or mood, and set the title, tags, and weights to customize the result. The generated vocals are created directly on the server, allowing you to instantly listen to the transformation. This is perfect for experimenting with new arrangements, creating duets, or quickly producing professional-sounding tracks without needing a singer.

#### 🎵 Separate Vocals and Instruments
The Separate Vocals feature lets you split any music track into vocals and instrumental tracks. Simply upload your MP3, and the AI generates two clean tracks, one for vocals and one for instruments. You can listen to the original track alongside the separated versions instantly. This is perfect for karaoke, remixes, sample extraction, or exploring unique instrumentals, though sometimes unusual instruments, like the Armenian duduk, may appear in the vocal track due to AI interpretation.

####  🎵 AI-Generated Music Mashups
The AI-generated mashup feature lets you combine multiple audio tracks into a single, creative mix. Simply provide a prompt, style, and weights, and upload your tracks—either previously generated or any tracks you want. The AI uses the prompt to guide the style and lyrical direction, especially when Custom Mode is off, rather than specifying exact lyrics.

#### 🎵 Get & Generate Song Lyrics + Covers
Easily get lyrics, create lyrics and cover art for your tracks.

#### 👉 Links & Resources

- [Suno](https://suno.com/)  
- [Kie.ai](https://kie.ai/)  
---

All generated audio tracks are stored in the root audio folder of this repository. You can listen to or download the tracks directly from [audio folder](./audio)

#### 🚀 Clone and Run

```bash
# Clone the repository
git clone https://github.com/Ashot72/Suno-Music-Studio

# Navigate into the project directory
cd Suno-Music-Studio

# Copy .env.local,example to create a new .env file, then add your keys.
cp env.example .env

# Install dependencies
npm install

# Start the development server
npm run dev

# The app will be available at http://localhost:3000
```
#### 🛠 Debugging in VS Code

- Open the **Run** view (`View → Run` or `Ctrl+Shift+D`) to access the debug configuration

📺 **Video:(Music Generation)** [Watch on YouTube](https://youtu.be/NrE-OgeP3vw) 

📺 **Video:(Persona Generation)** [Watch on YouTube](https://youtu.be/x_RFbRAQIIY) 

📺 **Video:(Extending Music)** [Watch on YouTube](https://youtu.be/fonbDowlX2w) 

📺 **Video:(Upload & Extend Music)** [Watch on YouTube](https://youtu.be/oLdW8281ykk) 

📺 **Video:(Upload & Cover Music)** [Watch on YouTube](https://youtu.be/hFt9BumMNps) 

📺 **Video:(Add Instrumental)** [Watch on YouTube](https://youtu.be/BybVzDB1Kdg) 

📺 **Video:(Add Vocals)** [Watch on YouTube](https://youtu.be/9G6rNyPdW1w) 

📺 **Video:(Extracting Vocals & Instruments)** [Watch on YouTube](https://youtu.be/tKOhS9KrCqo) 

📺 **Video:(Generating Music Mashups)** [Watch on YouTube](https://youtu.be/CtMHrjQKC9c) 

📺 **Video:(Get & Generate Song Lyrics + Covers)** [Watch on YouTube](https://youtu.be/kkwSlLig78Q) 
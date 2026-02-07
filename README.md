#### 🚀 Web-Based Suno Music Studio: Advanced Track Generation with Custom Settings

This project demonstrates a web-based AI music studio powered by Suno and integrated via the kie.ai API. Users can generate instrumental or vocal tracks using Simple or Custom modes, controlling parameters like Style Weight, Weirdness, and Audio Weight. Tracks can include duets, hard rock, metal, piano meditation, or bilingual reggae, with multiple variations generated per request.

The app manages tracks with MongoDB and server-hosted audio files, supports search and deletion, and handles callbacks, debugging, and error management for reliable AI-driven music generation.

We are going to add more features later, including a web-based music app that will allow users to generate, extend, and customize music, create personas, produce covers, generate music videos, and manage tracks with advanced creative controls. A dashboard will let users organize and share their creations.

#### 🎤 Generating Persona
We implemented persona generation in KIE.ai to give vocal tracks a unique musical identity. A persona defines the performer’s voice, tone, emotion, and delivery, as well as the overall style, mood, and instrumentation. Personas allow you to generate new tracks that feel like they belong to the same musical world, even if the vocals differ. Only vocal tracks can be used to create a persona, and each persona can be saved, edited, and reused for consistent music generation.

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



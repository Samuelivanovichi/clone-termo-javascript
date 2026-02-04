# Termo Clone - Word Guessing Game (Pure JavaScript)

This project is a clone of the popular word-guessing game "Termo" (similar to Wordle), developed entirely using **HTML, CSS, and pure JavaScript (ES6 Modules)**. I created this game as a frontend challenge to apply modern web development concepts in a framework-free environment, focusing on DOM manipulation, state management, and user experience.

The project is currently live and can be played here: **https://clone-termo-javascript.vercel.app/**

## Architecture and Technical Decisions

I built this software following a state-based architecture. This means that all game logic resides within JavaScript objects, and the interface (HTML/CSS) merely "reads" and renders this state. This approach helps prevent common DOM manipulation bugs and makes the code more predictable and easier to maintain.

*   **Logic (`js/main.js`):** This is the "brain" of the game. It contains the core state machine ('playing', 'won', 'lost'), the word validation logic, and the management of player statistics.

*   **Data (`js/palavras.js`):** A dedicated module that exports a curated list of 6-letter words in Portuguese. Keeping it separate simplifies future updates to the dictionary.

*   **Presentation (`index.html` and `style.css`):** Features a semantic HTML structure with a focus on accessibility and a responsive design using an "earthy" color palette, including a toggleable dark mode.

## Implemented Features

*   **6x6 Grid with 6 Attempts**: The core game mechanics, featuring 6-letter words.
*   **Hybrid Keyboard**: The virtual on-screen keyboard is fully functional and synchronizes with the physical keyboard, providing instant visual feedback for each key press.
*   **State Persistence with `localStorage`**: The game saves your progress. If you refresh the page, the current game resumes from where you left off, and your statistics (wins, streaks) are preserved.
*   **Light and Dark Mode**: A toggle switch allows users to alternate between a light earthy color palette (cream/coffee) and a dark one (dark coffee/chocolate), with the user's preference being saved.
*   **Modals and Notifications**: Includes "Help" and "Statistics" modals, along with floating notifications (toasts) for quick feedback like "Invalid word!".
*   **Interactive Animations**: Implemented "shake" (for invalid input), "flip" (for revealing letters), and "dance" (for victories) animations to create a more polished and rewarding user experience.
*   **Share Functionality**: At the end of a game, players can copy their colored grid results (🟩🟨⬛) to share on social media.
*   **Restart Game**: A dedicated button to quickly start a new game, either from the header (with confirmation) or directly from the statistics modal after a game concludes.

## How to Run Locally

The project utilizes ES6 Modules, so it must be served from a local web server, rather than opening `index.html` directly.

1.  Clone this repository:
    ```bash
    git clone https://github.com/Samuelivanovichi/clone-termo-javascript.git
    cd clone-termo-javascript
    ```

2.  Start a local server. The easiest way is to use the **Live Server** VS Code extension, or if you have Python installed, via the terminal:
    ```bash
    python3 -m http.server
    ```

3.  Open your browser to the address provided (typically `http://localhost:8000`).

## Credits

This project was built by Samuel as part of my frontend development portfolio.

## License
Available under the MIT License.
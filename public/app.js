document.addEventListener("DOMContentLoaded", () => {

////////////////////////////////////////////////////
/////////// CREATE POLL PAGE ///////////////////////
////////////////////////////////////////////////////

// Run ONLY if NOT on poll.html
if (!window.location.pathname.includes("poll.html")) {

    // ADD OPTION
    window.addOption = function () {

        const optionsDiv = document.getElementById("options");

        const input = document.createElement("input");
        input.placeholder = "New Option";
        input.className = "option-input";

        optionsDiv.appendChild(input);
    };


    // CREATE POLL
    window.createPoll = async function (event) {

        // ✅ STOP FORM REFRESH
        if (event) event.preventDefault();

        try {

            const questionEl = document.getElementById("question");

            if (!questionEl) {
                console.error("Question element missing!");
                return;
            }

            const question = questionEl.value.trim();

            const optionInputs =
                document.querySelectorAll("#options input");

            const options = Array.from(optionInputs)
                .map(input => input.value.trim())
                .filter(val => val !== "");

            // ✅ Validation
            if (!question || options.length < 2) {
                alert("Enter a question and at least 2 options!");
                return;
            }

            const res = await fetch("/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question,
                    options
                })
            });

            if (!res.ok) {
                throw new Error("Server failed to create poll");
            }

            const data = await res.json();

            const linkDiv = document.getElementById("link");

            if (linkDiv) {
                linkDiv.innerHTML =
                    `✅ Poll Created! <br><br>
                    <a href="${data.link}" target="_blank">
                    ${window.location.origin}${data.link}
                    </a>`;
            }

        } catch (err) {

            console.error("CREATE POLL ERROR:", err);
            alert("Failed to create poll. Is your server running?");
        }
    };
}



////////////////////////////////////////////////////
///////////// VOTING PAGE ///////////////////////////
////////////////////////////////////////////////////

if (window.location.pathname.includes("poll.html")) {

    const socket = io();

    const params = new URLSearchParams(window.location.search);
    const pollId = params.get("id");

    // ⭐ VERY IMPORTANT
    socket.emit("joinPoll", pollId);

    const container = document.getElementById("options");
    const questionEl = document.getElementById("question");

    // ✅ Stop if no poll id
    if (!pollId) {
        if (questionEl)
            questionEl.innerText = "Invalid poll link!";
        return;
    }

    // UNIQUE VOTER ID
    let voterId = localStorage.getItem("voterId");

    if (!voterId) {
        voterId = crypto.randomUUID();
        localStorage.setItem("voterId", voterId);
    }

    // LOAD POLL
    fetch(`/poll/${pollId}`)
        .then(res => {

            if (!res.ok) {
                throw new Error("Poll not found");
            }

            return res.json();
        })
        .then(poll => {

            if (questionEl)
                questionEl.innerText = poll.question;

            container.innerHTML = "";

            poll.options.forEach((opt, index) => {

                const btn = document.createElement("button");
                btn.className = "vote-btn";
                btn.innerText = `${opt.text} — Click to Vote`;

                btn.onclick = () => {
                    socket.emit("vote", {
                        pollId,
                        optionIndex: index,
                        voterId
                    });
                };

                container.appendChild(btn);
            });
        })
        .catch(err => {
            console.error(err);
            if (questionEl)
                questionEl.innerText = "Poll not found or server error.";
        });


    // LIVE RESULTS
    socket.on("updateResults", (options) => {

        container.innerHTML = "";

        const totalVotes = options.reduce(
            (sum, opt) => sum + opt.votes, 0);

        options.forEach(opt => {

            const percent = totalVotes
                ? Math.round((opt.votes / totalVotes) * 100)
                : 0;

            const div = document.createElement("div");
            div.className = "option";

            div.innerHTML = `
                <strong>${opt.text} — ${percent}% (${opt.votes} votes)</strong>
                <div class="bar">
                    <div class="fill" style="width:${percent}%"></div>
                </div>
            `;

            container.appendChild(div);
        });
    });
}

});
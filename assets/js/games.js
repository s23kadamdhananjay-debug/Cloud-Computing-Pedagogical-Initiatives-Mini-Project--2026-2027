/* CloudBox — Cognitive Games arena
   Twelve self-contained mini-games with a shared modal, HUD, scoring and stats. */
(function () {
  "use strict";

  /* ------------------------------ data ------------------------------ */

  var GAMES = [
    {
      id: "target-sum", track: 1, icon: "🎯", title: "Target Sum",
      desc: "Pick the tiles that add up to the target number.",
      tip: "Two or three tiles usually make the target."
    },
    {
      id: "signal-sequence", track: 1, icon: "📶", title: "Signal Sequence",
      desc: "Repeat the flashing pattern as it grows longer.",
      tip: "Watch the pads first, then click them in the same order."
    },
    {
      id: "stack-sort", track: 1, icon: "📚", title: "Stack Sort",
      desc: "Click the numbers in ascending order.",
      tip: "A wrong tap costs a point — two wrong taps end the round."
    },
    {
      id: "function-machine", track: 1, icon: "⚙️", title: "Function Machine",
      desc: "Apply the shown rule to the input number.",
      tip: "The rules combine multiplication and addition."
    },
    {
      id: "pixel-logic", track: 1, icon: "🧩", title: "Pixel Logic",
      desc: "Choose the block that completes the mirror pattern.",
      tip: "The right half mirrors the left half, row by row."
    },
    {
      id: "matrix-complete", track: 1, icon: "🔷", title: "Matrix Complete",
      desc: "Find the missing symbol in the 3×3 grid.",
      tip: "Every row contains each symbol exactly once."
    },
    {
      id: "digit-challenge", track: 2, icon: "🔢", title: "Digit Challenge",
      desc: "Memorise the digits, then type them back.",
      tip: "The sequence gets one digit longer each round."
    },
    {
      id: "grid-challenge", track: 2, icon: "▦", title: "Grid Challenge",
      desc: "Remember which cells lit up on the board.",
      tip: "You get about two seconds to study the grid."
    },
    {
      id: "motion-challenge", track: 2, icon: "🖱️", title: "Motion Challenge",
      desc: "Hit eight moving targets as fast as you can.",
      tip: "Your average reaction time sets the performance index."
    },
    {
      id: "switch-challenge", track: 2, icon: "🔀", title: "Switch Challenge",
      desc: "Follow the cue: ink colour or written word.",
      tip: "INK means click the ink colour. WORD means click the written word."
    },
    {
      id: "geo-sudo", track: 2, icon: "🔺", title: "Geo-Sudo",
      desc: "Complete the 4×4 Latin square.",
      tip: "Each row and column uses the digits 1–4 exactly once."
    },
    {
      id: "inductive-challenge", track: 2, icon: "🧠", title: "Inductive Challenge",
      desc: "Work out the next number in the series.",
      tip: "Look for a constant step, a ratio, or square numbers."
    }
  ];

  var STATS_KEY = "cloudbox.gameStats.v1";
  var MAX_SESSIONS = 50;

  /* ------------------------------ helpers ------------------------------ */

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  function pick(list) {
    return list[randInt(0, list.length - 1)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function waitUntil(api, condition) {
    while (!api.cancelled && !condition()) {
      await api.sleep(50);
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ------------------------------ stats ------------------------------ */

  var stats = loadStats();
  var statPlays = document.getElementById("statPlays");
  var statAvg = document.getElementById("statAvg");
  var statGames = document.getElementById("statGames");

  function loadStats() {
    try {
      var raw = localStorage.getItem(STATS_KEY);
      if (!raw) return { plays: 0, history: [], best: {} };
      var parsed = JSON.parse(raw);
      return {
        plays: Number(parsed.plays) || 0,
        history: Array.isArray(parsed.history) ? parsed.history.filter(function (item) {
          return item && typeof item.score === "number";
        }) : [],
        best: parsed.best && typeof parsed.best === "object" ? parsed.best : {}
      };
    } catch (error) {
      return { plays: 0, history: [], best: {} };
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      /* Private mode: analytics stay in memory. */
    }
  }

  function renderStats() {
    if (statPlays) statPlays.textContent = String(stats.plays);
    if (statGames) statGames.textContent = String(GAMES.length);

    var recent = stats.history.slice(-20);
    if (statAvg) {
      if (!recent.length) {
        statAvg.textContent = "—";
      } else {
        var total = recent.reduce(function (sum, item) { return sum + item.score; }, 0);
        statAvg.textContent = String(Math.round(total / recent.length));
      }
    }
  }

  /* ------------------------------ cards ------------------------------ */

  var track1Grid = document.getElementById("track1Grid");
  var track2Grid = document.getElementById("track2Grid");

  function cardMarkup(game) {
    var best = stats.best[game.id];
    var badge = game.track === 1 ? "cyan" : "violet";
    return '' +
      '<article class="game-card" data-track="' + game.track + '" data-game="' + game.id + '" role="button" tabindex="0" aria-label="Play ' + game.title + '">' +
        '<div class="game-top">' +
          '<span class="game-ico" aria-hidden="true">' + game.icon + '</span>' +
          '<span class="badge ' + badge + '">Track ' + game.track + '</span>' +
        '</div>' +
        '<h3>' + game.title + '</h3>' +
        '<p>' + game.desc + '</p>' +
        '<div class="game-foot">' +
          '<span class="best">' + (best ? 'Best <b>' + best + '</b>' : 'Not played yet') + '</span>' +
          '<span class="play-pill">Play ▶</span>' +
        '</div>' +
      '</article>';
  }

  function renderCards() {
    if (!track1Grid || !track2Grid) return;
    track1Grid.innerHTML = GAMES.filter(function (g) { return g.track === 1; }).map(cardMarkup).join("");
    track2Grid.innerHTML = GAMES.filter(function (g) { return g.track === 2; }).map(cardMarkup).join("");
  }

  /* ------------------------------ modal ------------------------------ */

  var modal = document.getElementById("gameModal");
  var stage = document.getElementById("gameStage");
  var gameTitle = document.getElementById("gameTitle");
  var gameTrack = document.getElementById("gameTrack");
  var gameHint = document.getElementById("gameHint");
  var hudRound = document.getElementById("hudRound");
  var hudScore = document.getElementById("hudScore");
  var lastFocus = null;
  var session = null;

  function setHud(round, total, score) {
    if (hudRound) hudRound.innerHTML = "Round <b>" + round + "</b> / " + (total || 5);
    if (hudScore) hudScore.innerHTML = "Score <b>" + clamp(Math.round(score), 0, 100) + "</b>";
  }

  function openGame(id) {
    var game = null;
    for (var i = 0; i < GAMES.length; i += 1) {
      if (GAMES[i].id === id) { game = GAMES[i]; break; }
    }
    if (!game || !modal) return;

    if (session) session.cancelled = true;

    var current = { game: game, cancelled: false, finished: false };
    session = current;
    lastFocus = document.activeElement;

    gameTitle.textContent = game.title;
    gameTrack.textContent = game.track === 1 ? "Track 1 · Cognitive Aptitude" : "Track 2 · Game-Based Assessment";
    gameTrack.className = "badge " + (game.track === 1 ? "cyan" : "violet");
    gameHint.textContent = game.tip;
    stage.innerHTML = "";
    setHud(1, 5, 0);

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    var closeBtn = modal.querySelector("[data-close]");
    if (closeBtn && closeBtn.focus) closeBtn.focus();

    var api = {
      get cancelled() { return current.cancelled; },
      setRound: function (round, total) {
        if (hudRound) hudRound.innerHTML = "Round <b>" + round + "</b> / " + (total || 5);
      },
      setScore: function (score) {
        if (hudScore) hudScore.innerHTML = "Score <b>" + clamp(Math.round(score), 0, 100) + "</b>";
      },
      sleep: sleep,
      finish: function (score, detail) {
        finishSession(current, score, detail);
      }
    };

    try {
      PLAYERS[game.id](stage, api);
    } catch (error) {
      stage.innerHTML = '<div class="game-prompt">This game could not start. Please reload the page.</div>';
    }
  }

  function closeGame() {
    if (!modal) return;
    if (session) session.cancelled = true;
    session = null;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    stage.innerHTML = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function finishSession(current, rawScore, detail) {
    if (!current || current.finished) return;
    current.finished = true;
    current.cancelled = true;

    var score = clamp(Math.round(rawScore), 0, 100);
    stats.plays += 1;
    stats.history.push({ id: current.game.id, score: score, at: Date.now() });
    if (stats.history.length > MAX_SESSIONS) {
      stats.history = stats.history.slice(-MAX_SESSIONS);
    }
    stats.best[current.game.id] = Math.max(Number(stats.best[current.game.id]) || 0, score);
    saveStats();
    renderStats();
    renderCards();

    if (hudRound) hudRound.innerHTML = "Session complete";
    if (hudScore) hudScore.innerHTML = "Index <b>" + score + "</b>";

    var message = score >= 85 ? "Outstanding" : score >= 65 ? "Strong result" : score >= 45 ? "Good effort" : "Keep practising";
    var best = stats.best[current.game.id] || score;

    stage.innerHTML = '' +
      '<div class="result">' +
        '<div class="score-ring" style="--p:' + score + '"><div><strong>' + score + '</strong><span>Index</span></div></div>' +
        '<h3>' + message + '</h3>' +
        '<p>' + detail + '<br>Personal best: <b>' + best + '</b> · Index out of 100</p>' +
        '<div class="game-actions">' +
          '<button type="button" class="btn btn-primary" id="replayBtn">↻ Play again</button>' +
          '<button type="button" class="btn" id="resultClose">Back to games</button>' +
        '</div>' +
      '</div>';

    var replay = document.getElementById("replayBtn");
    var resultClose = document.getElementById("resultClose");
    if (replay) replay.addEventListener("click", function () { openGame(current.game.id); });
    if (resultClose) resultClose.addEventListener("click", closeGame);
  }

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target.hasAttribute("data-close") || event.target.classList.contains("modal-backdrop")) {
        closeGame();
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal && modal.classList.contains("open")) {
      closeGame();
    }
  });

  document.addEventListener("click", function (event) {
    var card = event.target.closest ? event.target.closest(".game-card") : null;
    if (card) openGame(card.getAttribute("data-game"));
  });

  document.addEventListener("keydown", function (event) {
    var target = event.target;
    if (!target || !target.classList || !target.classList.contains("game-card")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGame(target.getAttribute("data-game"));
    }
  });

  /* --------------------------- shared renders --------------------------- */

  function renderOptions(options, onPick) {
    var grid = el("div", "options-grid");
    options.forEach(function (label) {
      var button = el("button", "option-btn", label);
      button.type = "button";
      button.dataset.value = label;
      button.addEventListener("click", function () { onPick(label, button); });
      grid.appendChild(button);
    });
    return grid;
  }

  function renderFeedback(message, good) {
    var node = el("div", "game-feedback" + (good === undefined ? "" : good ? " good" : " bad"), message);
    node.setAttribute("aria-live", "polite");
    return node;
  }

  /* ------------------------------ players ------------------------------ */

  var PLAYERS = {};

  /* 1. Target Sum */
  PLAYERS["target-sum"] = function (stage, api) {
    var solved = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 targets solved");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var nums = [];
      while (nums.length < 4) {
        var candidate = randInt(1, 9);
        if (nums.indexOf(candidate) === -1) nums.push(candidate);
      }
      var subset = shuffle([0, 1, 2, 3]).slice(0, randInt(2, 3));
      var target = subset.reduce(function (sum, index) { return sum + nums[index]; }, 0);

      stage.innerHTML = '' +
        '<div class="game-prompt">Tap the tiles that add up to <strong>' + target + '</strong>.</div>' +
        '<div class="tile-row" id="sumTiles"></div>' +
        '<div class="game-actions"><button type="button" class="btn btn-primary" id="checkSum" disabled>Check answer</button></div>' +
        '<div class="game-feedback" id="sumFeedback" aria-live="polite"></div>';

      var row = stage.querySelector("#sumTiles");
      var check = stage.querySelector("#checkSum");
      var feedback = stage.querySelector("#sumFeedback");
      var selected = new Set();
      var locked = false;

      nums.forEach(function (value, index) {
        var tile = el("button", "num-tile", String(value));
        tile.type = "button";
        tile.addEventListener("click", function () {
          if (locked) return;
          if (selected.has(index)) {
            selected.delete(index);
            tile.classList.remove("selected");
          } else {
            selected.add(index);
            tile.classList.add("selected");
          }
          check.disabled = selected.size === 0;
        });
        row.appendChild(tile);
      });

      check.addEventListener("click", function () {
        if (locked) return;
        locked = true;
        check.disabled = true;

        var sum = 0;
        selected.forEach(function (index) { sum += nums[index]; });
        var correct = sum === target;
        var tiles = row.querySelectorAll(".num-tile");
        selected.forEach(function (index) {
          tiles[index].classList.add(correct ? "ok" : "bad");
        });

        if (correct) {
          solved += 1;
          feedback.className = "game-feedback good";
          feedback.textContent = "Correct — that makes " + target + ".";
        } else {
          feedback.className = "game-feedback bad";
          feedback.textContent = "Your tiles add up to " + sum + ", not " + target + ".";
        }
        api.setScore((solved / 5) * 100);
        setTimeout(nextRound, 1100);
      });
    }

    nextRound();
  };

  /* 2. Signal Sequence */
  PLAYERS["signal-sequence"] = function (stage, api) {
    var colors = ["#22d3ee", "#8b5cf6", "#f472b6", "#fbbf24"];
    var solved = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 sequences repeated");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var length = round + 2;
      var sequence = [];
      for (var i = 0; i < length; i += 1) sequence.push(randInt(0, 3));

      stage.innerHTML = '' +
        '<div class="game-prompt">Watch the pattern, then repeat it.<br><span class="small">Sequence length: <strong>' + length + '</strong></span></div>' +
        '<div class="pad-grid" id="padGrid"></div>' +
        '<div class="game-feedback" id="padFeedback" aria-live="polite">Get ready…</div>';

      var grid = stage.querySelector("#padGrid");
      var feedback = stage.querySelector("#padFeedback");
      var pads = [];

      colors.forEach(function (color, index) {
        var pad = el("button", "pad");
        pad.type = "button";
        pad.style.background = color;
        pad.style.color = color;
        pad.setAttribute("aria-label", "Signal pad " + (index + 1));
        grid.appendChild(pad);
        pads.push(pad);
      });

      var state = { accepting: false, index: 0, done: false, failed: false };

      pads.forEach(function (pad, index) {
        pad.addEventListener("click", function () {
          if (!state.accepting) return;
          if (index === sequence[state.index]) {
            pad.classList.add("lit");
            setTimeout(function () { pad.classList.remove("lit"); }, 180);
            state.index += 1;
            if (state.index === sequence.length) {
              state.accepting = false;
              state.done = true;
            }
          } else {
            state.accepting = false;
            state.failed = true;
            pad.classList.add("lit");
            setTimeout(function () { pad.classList.remove("lit"); }, 280);
            feedback.className = "game-feedback bad";
            feedback.textContent = "Wrong pad — the pattern was " + sequence.map(function (n) { return n + 1; }).join(" · ");
          }
        });
      });

      (async function play() {
        feedback.textContent = "Watch closely…";
        await api.sleep(600);
        for (var step = 0; step < sequence.length; step += 1) {
          if (api.cancelled) return;
          var pad = pads[sequence[step]];
          pad.classList.add("lit");
          await api.sleep(360);
          pad.classList.remove("lit");
          await api.sleep(180);
        }
        if (api.cancelled) return;

        feedback.className = "game-feedback";
        feedback.textContent = "Your turn — repeat " + sequence.length + " signals.";
        state.accepting = true;

        await waitUntil(api, function () { return state.done || state.failed; });
        if (api.cancelled) return;

        if (state.done) {
          solved += 1;
          feedback.className = "game-feedback good";
          feedback.textContent = "Perfect sequence!";
        }
        api.setScore((solved / 5) * 100);
        await api.sleep(1000);
        nextRound();
      })();
    }

    nextRound();
  };

  /* 3. Stack Sort */
  PLAYERS["stack-sort"] = function (stage, api) {
    var points = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish(points, points + " of 100 points earned");
        return;
      }
      api.setRound(round);
      api.setScore(points);

      var nums = [];
      while (nums.length < 6) {
        var value = randInt(4, 64);
        if (nums.indexOf(value) === -1) nums.push(value);
      }
      var sorted = nums.slice().sort(function (a, b) { return a - b; });

      stage.innerHTML = '' +
        '<div class="game-prompt">Click the numbers in <strong>ascending order</strong>.</div>' +
        '<div class="sort-row" id="sortRow"></div>' +
        '<div class="game-feedback" id="sortFeedback" aria-live="polite">Smallest first.</div>';

      var row = stage.querySelector("#sortRow");
      var feedback = stage.querySelector("#sortFeedback");
      var next = 0;
      var mistakes = 0;
      var done = false;

      shuffle(nums).forEach(function (value) {
        var tile = el("button", "sort-tile", String(value));
        tile.type = "button";
        tile.addEventListener("click", function () {
          if (done) return;
          if (Number(tile.textContent) === sorted[next]) {
            tile.classList.add("done");
            tile.disabled = true;
            next += 1;
            if (next === sorted.length) {
              done = true;
              var gained = Math.max(4, 20 - mistakes * 4);
              points += gained;
              api.setScore(points);
              feedback.className = "game-feedback good";
              feedback.textContent = "Sorted! +" + gained + " points";
              setTimeout(nextRound, 950);
            }
          } else {
            mistakes += 1;
            tile.classList.add("wrong");
            setTimeout(function () { tile.classList.remove("wrong"); }, 340);
            feedback.className = "game-feedback bad";
            feedback.textContent = mistakes >= 2
              ? "Order: " + sorted.join(" · ")
              : "Not the smallest remaining number.";
            if (mistakes >= 2) {
              done = true;
              setTimeout(nextRound, 1300);
            }
          }
        });
        row.appendChild(tile);
      });
    }

    nextRound();
  };

  /* 4. Function Machine */
  PLAYERS["function-machine"] = function (stage, api) {
    var rules = [
      { label: "× 2 + 1", apply: function (n) { return n * 2 + 1; } },
      { label: "× 2 + 5", apply: function (n) { return n * 2 + 5; } },
      { label: "× 3 − 2", apply: function (n) { return n * 3 - 2; } },
      { label: "× 3 + 1", apply: function (n) { return n * 3 + 1; } },
      { label: "× 4 − 3", apply: function (n) { return n * 4 - 3; } }
    ];
    var solved = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 rules applied correctly");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var rule = pick(rules);
      var input = randInt(2, 9);
      var answer = rule.apply(input);
      var options = [answer];
      while (options.length < 4) {
        var candidate = answer + pick([-3, -2, -1, 1, 2, 3, 4]);
        if (candidate > 0 && options.indexOf(candidate) === -1) options.push(candidate);
      }
      options = shuffle(options);

      stage.innerHTML = '' +
        '<div class="game-prompt">Apply the rule to the input.</div>' +
        '<div class="function-box">' +
          '<div class="fb-item"><span>Input</span><strong>' + input + '</strong></div>' +
          '<div class="fb-rule">' + rule.label + '</div>' +
          '<div class="fb-item"><span>Output</span><strong>?</strong></div>' +
        '</div>' +
        '<div class="options-grid" id="fmOptions"></div>' +
        '<div class="game-feedback" id="fmFeedback" aria-live="polite"></div>';

      var grid = stage.querySelector("#fmOptions");
      var feedback = stage.querySelector("#fmFeedback");
      var answered = false;

      options.forEach(function (value) {
        var button = el("button", "option-btn", String(value));
        button.type = "button";
        button.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          if (value === answer) {
            solved += 1;
            button.classList.add("correct");
            feedback.className = "game-feedback good";
            feedback.textContent = input + " " + rule.label + " = " + answer;
          } else {
            button.classList.add("wrong");
            grid.querySelectorAll(".option-btn").forEach(function (node) {
              if (Number(node.textContent) === answer) node.classList.add("correct");
            });
            feedback.className = "game-feedback bad";
            feedback.textContent = "The correct output was " + answer + ".";
          }
          api.setScore((solved / 5) * 100);
          setTimeout(nextRound, 1050);
        });
        grid.appendChild(button);
      });
    }

    nextRound();
  };

  /* 5. Pixel Logic */
  PLAYERS["pixel-logic"] = function (stage, api) {
    var solved = 0;
    var round = 0;

    function randomBlock() {
      var block = [];
      for (var row = 0; row < 5; row += 1) {
        block.push([randInt(0, 1), randInt(0, 1)]);
      }
      return block;
    }

    function blockKey(block) {
      return block.map(function (row) { return row.join(""); }).join("|");
    }

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 patterns completed");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var full = [];
      for (var row = 0; row < 5; row += 1) {
        var left = [randInt(0, 1), randInt(0, 1), randInt(0, 1)];
        full.push([left[0], left[1], left[2], left[1], left[0]]);
      }

      var correct = full.map(function (line) { return [line[3], line[4]]; });
      var correctKey = blockKey(correct);
      var options = [correct];
      var seen = [correctKey];

      while (options.length < 4) {
        var candidate = randomBlock();
        var key = blockKey(candidate);
        if (seen.indexOf(key) === -1) {
          seen.push(key);
          options.push(candidate);
        }
      }
      options = shuffle(options);
      var correctIndex = options.findIndex(function (block) { return blockKey(block) === correctKey; });

      stage.innerHTML = '' +
        '<div class="game-prompt">The left side is mirrored on the right. Which block completes the pattern?</div>' +
        '<div class="pattern-wrap"><div class="pattern-grid" id="patternGrid" aria-hidden="true"></div></div>' +
        '<div class="option-grids" id="patternOptions"></div>' +
        '<div class="game-feedback" id="pixelFeedback" aria-live="polite"></div>';

      var grid = stage.querySelector("#patternGrid");
      full.forEach(function (line) {
        for (var col = 0; col < 5; col += 1) {
          var cell = el("i", "pcell");
          if (col >= 3) {
            cell.classList.add("mask");
          } else if (line[col]) {
            cell.classList.add("on");
          }
          grid.appendChild(cell);
        }
      });

      var optionWrap = stage.querySelector("#patternOptions");
      var feedback = stage.querySelector("#pixelFeedback");
      var answered = false;

      options.forEach(function (block, index) {
        var button = el("button", "option-grid");
        button.type = "button";
        button.setAttribute("aria-label", "Pattern option " + (index + 1));
        var mini = el("span", "mini-grid");
        block.forEach(function (line) {
          line.forEach(function (value) {
            var dot = el("i", value ? "on" : "");
            mini.appendChild(dot);
          });
        });
        button.appendChild(mini);
        button.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          if (index === correctIndex) {
            solved += 1;
            button.style.borderColor = "var(--green)";
            feedback.className = "game-feedback good";
            feedback.textContent = "Correct — the halves match.";
          } else {
            button.style.borderColor = "var(--red)";
            feedback.className = "game-feedback bad";
            feedback.textContent = "Not quite — mirror each row from left to right.";
          }
          api.setScore((solved / 5) * 100);
          setTimeout(nextRound, 1100);
        });
        optionWrap.appendChild(button);
      });
    }

    nextRound();
  };

  /* 6. Matrix Complete */
  PLAYERS["matrix-complete"] = function (stage, api) {
    var symbols = ["●", "▲", "■"];
    var base = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    var solved = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 matrices completed");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var map = shuffle(symbols);
      var grid = base.map(function (line) {
        return line.map(function (value) { return map[value]; });
      });
      var blankRow = randInt(0, 2);
      var blankCol = randInt(0, 2);
      var answer = grid[blankRow][blankCol];

      stage.innerHTML = '' +
        '<div class="game-prompt">Which symbol belongs in the dashed cell?</div>' +
        '<div class="matrix" id="matrixGrid"></div>' +
        '<div class="matrix-options" id="matrixOptions"></div>' +
        '<div class="game-feedback" id="matrixFeedback" aria-live="polite"></div>';

      var gridNode = stage.querySelector("#matrixGrid");
      grid.forEach(function (line, rowIndex) {
        line.forEach(function (symbol, colIndex) {
          var cell = el("div", "mcell", rowIndex === blankRow && colIndex === blankCol ? "" : symbol);
          if (rowIndex === blankRow && colIndex === blankCol) cell.classList.add("blank");
          gridNode.appendChild(cell);
        });
      });

      var optionWrap = stage.querySelector("#matrixOptions");
      var feedback = stage.querySelector("#matrixFeedback");
      var answered = false;

      symbols.forEach(function (symbol) {
        var button = el("button", "mopt", symbol);
        button.type = "button";
        button.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          if (symbol === answer) {
            solved += 1;
            button.classList.add("correct");
            feedback.className = "game-feedback good";
            feedback.textContent = "Correct!";
          } else {
            button.classList.add("wrong");
            optionWrap.querySelectorAll(".mopt").forEach(function (node) {
              if (node.textContent === answer) node.classList.add("correct");
            });
            feedback.className = "game-feedback bad";
            feedback.textContent = "The missing symbol was " + answer + ".";
          }
          api.setScore((solved / 5) * 100);
          setTimeout(nextRound, 950);
        });
        optionWrap.appendChild(button);
      });
    }

    nextRound();
  };

  /* 7. Digit Challenge */
  PLAYERS["digit-challenge"] = function (stage, api) {
    var solved = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 sequences recalled");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var length = round + 3;
      var digits = "";
      for (var i = 0; i < length; i += 1) digits += String(randInt(0, 9));

      stage.innerHTML = '' +
        '<div class="game-prompt">Memorise these digits.</div>' +
        '<div class="seq-display">' + digits + '</div>' +
        '<div class="game-feedback">Hiding in a moment…</div>';

      (async function play() {
        await api.sleep(900 + length * 320);
        if (api.cancelled) return;

        stage.innerHTML = '' +
          '<div class="game-prompt">Type the ' + length + ' digits you saw.</div>' +
          '<input id="digitAnswer" class="digit-input" inputmode="numeric" autocomplete="off" maxlength="' + length + '" aria-label="Enter the digits" />' +
          '<div class="game-actions"><button type="button" class="btn btn-primary" id="digitCheck">Check</button></div>' +
          '<div class="game-feedback" id="digitFeedback" aria-live="polite"></div>';

        var input = stage.querySelector("#digitAnswer");
        var check = stage.querySelector("#digitCheck");
        var feedback = stage.querySelector("#digitFeedback");
        var done = false;

        input.focus();

        function submit() {
          if (done) return;
          var value = input.value.replace(/\D/g, "");
          if (!value) return;
          done = true;
          input.disabled = true;
          check.disabled = true;

          if (value === digits) {
            solved += 1;
            feedback.className = "game-feedback good";
            feedback.textContent = "Correct — " + digits + ".";
          } else {
            feedback.className = "game-feedback bad";
            feedback.textContent = "The sequence was " + digits + ".";
          }
          api.setScore((solved / 5) * 100);
          setTimeout(nextRound, 1100);
        }

        check.addEventListener("click", submit);
        input.addEventListener("keydown", function (event) {
          if (event.key === "Enter") submit();
        });
      })();
    }

    nextRound();
  };

  /* 8. Grid Challenge */
  PLAYERS["grid-challenge"] = function (stage, api) {
    var solved = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 grids matched");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var count = round + 2;
      var target = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]).slice(0, count);
      var picked = new Set();
      var locked = true;
      var done = false;

      stage.innerHTML = '' +
        '<div class="game-prompt">Remember the highlighted cells.<br><span class="small"><strong>' + count + '</strong> cells will light up.</span></div>' +
        '<div class="grid-board" id="gridBoard"></div>' +
        '<div class="game-actions"><button type="button" class="btn btn-primary" id="gridCheck" disabled>Check</button></div>' +
        '<div class="game-feedback" id="gridFeedback" aria-live="polite">Study the board…</div>';

      var board = stage.querySelector("#gridBoard");
      var check = stage.querySelector("#gridCheck");
      var feedback = stage.querySelector("#gridFeedback");
      var cells = [];

      for (var i = 0; i < 16; i += 1) {
        var cell = el("button", "gcell");
        cell.type = "button";
        cell.dataset.index = String(i);
        cell.setAttribute("aria-label", "Cell " + (i + 1));
        board.appendChild(cell);
        cells.push(cell);
      }

      target.forEach(function (index) { cells[index].classList.add("shown"); });

      cells.forEach(function (cell) {
        cell.addEventListener("click", function () {
          if (locked || done) return;
          var index = Number(cell.dataset.index);
          if (picked.has(index)) {
            picked.delete(index);
            cell.classList.remove("picked");
          } else {
            picked.add(index);
            cell.classList.add("picked");
          }
          check.disabled = picked.size !== count;
        });
      });

      check.addEventListener("click", function () {
        if (done) return;
        done = true;
        locked = true;
        check.disabled = true;

        var correct = picked.size === count && target.every(function (index) { return picked.has(index); });
        if (correct) {
          solved += 1;
          feedback.className = "game-feedback good";
          feedback.textContent = "Perfect recall!";
        } else {
          feedback.className = "game-feedback bad";
          feedback.textContent = "Not quite — the lit cells are shown in green.";
        }

        target.forEach(function (index) {
          if (!picked.has(index)) cells[index].classList.add("missed");
          else cells[index].classList.add("correct");
        });
        picked.forEach(function (index) {
          if (target.indexOf(index) === -1) cells[index].classList.add("missed");
        });

        api.setScore((solved / 5) * 100);
        setTimeout(nextRound, 1400);
      });

      setTimeout(function () {
        if (api.cancelled) return;
        cells.forEach(function (cell) { cell.classList.remove("shown"); });
        locked = false;
        feedback.textContent = "Now click the " + count + " cells you remember.";
      }, 2100);
    }

    nextRound();
  };

  /* 9. Motion Challenge */
  PLAYERS["motion-challenge"] = function (stage, api) {
    var total = 8;
    var hits = 0;
    var times = [];
    var start = 0;

    api.setRound(1, 1);
    api.setScore(0);

    stage.innerHTML = '' +
      '<div class="game-prompt">Click each target as fast as you can.</div>' +
      '<div class="arena" id="arena"></div>' +
      '<div class="game-feedback" id="motionFeedback">Target 1 / ' + total + '</div>';

    var arena = stage.querySelector("#arena");
    var feedback = stage.querySelector("#motionFeedback");

    function finish() {
      var avg = times.length ? times.reduce(function (a, b) { return a + b; }, 0) / times.length : 0;
      var index = clamp(Math.round(100 - (avg - 350) / 15), 10, 100);
      api.finish(index, "Average reaction " + Math.round(avg) + " ms across " + total + " targets");
    }

    function spawn() {
      if (api.cancelled) return;
      if (hits >= total) {
        finish();
        return;
      }

      var old = arena.querySelector(".target");
      if (old) old.parentNode.removeChild(old);

      var target = el("button", "target");
      target.type = "button";
      target.style.left = (12 + Math.random() * 76) + "%";
      target.style.top = (15 + Math.random() * 70) + "%";
      target.setAttribute("aria-label", "Target " + (hits + 1));
      arena.appendChild(target);
      feedback.textContent = "Target " + (hits + 1) + " / " + total;
      start = performance.now();

      target.addEventListener("click", function (event) {
        event.stopPropagation();
        times.push(performance.now() - start);
        hits += 1;
        var avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
        api.setScore(clamp(Math.round(100 - (avg - 350) / 15), 10, 100));
        target.parentNode.removeChild(target);
        if (hits >= total) finish();
        else spawn();
      });
    }

    spawn();
  };

  /* 10. Switch Challenge */
  PLAYERS["switch-challenge"] = function (stage, api) {
    var colors = [
      { name: "Red", hex: "#f87171" },
      { name: "Green", hex: "#34d399" },
      { name: "Blue", hex: "#60a5fa" },
      { name: "Yellow", hex: "#fbbf24" }
    ];
    var correctCount = 0;
    var trialCount = 0;
    var rounds = 5;
    var trialsPerRound = 3;

    (async function run() {
      for (var round = 1; round <= rounds; round += 1) {
        if (api.cancelled) return;
        api.setRound(round, rounds);

        for (var trial = 0; trial < trialsPerRound; trial += 1) {
          if (api.cancelled) return;

          var inkIndex = randInt(0, 3);
          var wordIndex = randInt(0, 3);
          while (wordIndex === inkIndex) wordIndex = randInt(0, 3);
          var cue = pick(["INK", "WORD"]);
          var answer = cue === "INK" ? colors[inkIndex].name : colors[wordIndex].name;

          stage.innerHTML = '' +
            '<div class="game-prompt">Click the <strong>' + (cue === "INK" ? "ink colour" : "written word") + '</strong>.</div>' +
            '<div class="stroop-word" style="color:' + colors[inkIndex].hex + '">' + colors[wordIndex].name + '</div>' +
            '<div class="options-grid" id="switchOptions"></div>' +
            '<div class="game-feedback" id="switchFeedback" aria-live="polite"></div>';

          var grid = stage.querySelector("#switchOptions");
          var feedback = stage.querySelector("#switchFeedback");
          var chosen = null;

          shuffle(colors).forEach(function (color) {
            var button = el("button", "option-btn", color.name);
            button.type = "button";
            button.addEventListener("click", function () {
              if (chosen) return;
              chosen = color.name;
            });
            grid.appendChild(button);
          });

          await waitUntil(api, function () { return chosen !== null; });
          if (api.cancelled) return;

          trialCount += 1;
          var isCorrect = chosen === answer;

          grid.querySelectorAll(".option-btn").forEach(function (button) {
            if (button.textContent === answer) button.classList.add("correct");
            else if (button.textContent === chosen) button.classList.add("wrong");
          });

          if (isCorrect) {
            correctCount += 1;
            feedback.className = "game-feedback good";
            feedback.textContent = "Correct — " + answer + ".";
          } else {
            feedback.className = "game-feedback bad";
            feedback.textContent = "The answer was " + answer + ".";
          }

          api.setScore((correctCount / (rounds * trialsPerRound)) * 100);
          await api.sleep(620);
        }
      }

      if (api.cancelled) return;
      api.finish((correctCount / (rounds * trialsPerRound)) * 100, correctCount + " of " + (rounds * trialsPerRound) + " trials correct");
    })();
  };

  /* 11. Geo-Sudo */
  PLAYERS["geo-sudo"] = function (stage, api) {
    var base = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]];
    var solved = 0;
    var round = 0;

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 squares solved");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var digitMap = shuffle([1, 2, 3, 4]);
      var grid = base.map(function (line) {
        return line.map(function (value) { return digitMap[value - 1]; });
      });

      var rowOrder = shuffle([0, 1, 2, 3]);
      var colOrder = shuffle([0, 1, 2, 3]);
      var source = grid;
      grid = rowOrder.map(function (rowIndex) {
        return colOrder.map(function (colIndex) { return source[rowIndex][colIndex]; });
      });

      var blankRow = randInt(0, 3);
      var blankCol = randInt(0, 3);
      var answer = grid[blankRow][blankCol];

      stage.innerHTML = '' +
        '<div class="game-prompt">Which digit belongs in the dashed cell?</div>' +
        '<div class="sudoku-board" id="sudokuBoard"></div>' +
        '<div class="options-grid" id="sudokuOptions" style="grid-template-columns: repeat(4, 1fr); width: min(300px, 100%);"></div>' +
        '<div class="game-feedback" id="sudokuFeedback" aria-live="polite"></div>';

      var board = stage.querySelector("#sudokuBoard");
      grid.forEach(function (line, rowIndex) {
        line.forEach(function (value, colIndex) {
          var cell = el("div", "sudoku-cell", rowIndex === blankRow && colIndex === blankCol ? "?" : String(value));
          if (rowIndex === blankRow && colIndex === blankCol) cell.classList.add("blank");
          board.appendChild(cell);
        });
      });

      var optionWrap = stage.querySelector("#sudokuOptions");
      var feedback = stage.querySelector("#sudokuFeedback");
      var answered = false;

      [1, 2, 3, 4].forEach(function (digit) {
        var button = el("button", "option-btn", String(digit));
        button.type = "button";
        button.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          if (digit === answer) {
            solved += 1;
            button.classList.add("correct");
            feedback.className = "game-feedback good";
            feedback.textContent = "Correct — the square is complete.";
          } else {
            button.classList.add("wrong");
            feedback.className = "game-feedback bad";
            feedback.textContent = "The missing digit was " + answer + ".";
          }
          api.setScore((solved / 5) * 100);
          setTimeout(nextRound, 950);
        });
        optionWrap.appendChild(button);
      });
    }

    nextRound();
  };

  /* 12. Inductive Challenge */
  PLAYERS["inductive-challenge"] = function (stage, api) {
    var solved = 0;
    var round = 0;

    function buildSeries() {
      var type = pick(["add", "add", "multiply", "square"]);
      var terms = [];
      var answer = 0;

      if (type === "add") {
        var start = randInt(1, 9);
        var step = randInt(2, 9) + round;
        for (var i = 0; i < 4; i += 1) terms.push(start + step * i);
        answer = start + step * 4;
      } else if (type === "multiply") {
        var first = randInt(1, 4);
        var ratio = pick([2, 3]);
        for (var j = 0; j < 4; j += 1) terms.push(first * Math.pow(ratio, j));
        answer = first * Math.pow(ratio, 4);
      } else {
        var base = randInt(1, 4) + round;
        for (var k = 0; k < 4; k += 1) terms.push((base + k) * (base + k));
        answer = (base + 4) * (base + 4);
      }

      var options = [answer];
      while (options.length < 4) {
        var candidate = answer + pick([-12, -9, -6, -3, 3, 6, 9, 12]);
        if (candidate > 0 && options.indexOf(candidate) === -1) options.push(candidate);
      }

      return { terms: terms, answer: answer, options: shuffle(options) };
    }

    function nextRound() {
      if (api.cancelled) return;
      round += 1;
      if (round > 5) {
        api.finish((solved / 5) * 100, solved + " of 5 series solved");
        return;
      }
      api.setRound(round);
      api.setScore((solved / 5) * 100);

      var series = buildSeries();

      stage.innerHTML = '' +
        '<div class="game-prompt">What comes next in the series?</div>' +
        '<div class="seq-display" style="font-size: clamp(1.45rem, 6vw, 2.2rem); letter-spacing: .05em;">' +
          series.terms.join(" · ") + ' · <span style="color: var(--cyan)">?</span>' +
        '</div>' +
        '<div class="options-grid" id="inductiveOptions"></div>' +
        '<div class="game-feedback" id="inductiveFeedback" aria-live="polite"></div>';

      var grid = stage.querySelector("#inductiveOptions");
      var feedback = stage.querySelector("#inductiveFeedback");
      var answered = false;

      series.options.forEach(function (value) {
        var button = el("button", "option-btn", String(value));
        button.type = "button";
        button.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          if (value === series.answer) {
            solved += 1;
            button.classList.add("correct");
            feedback.className = "game-feedback good";
            feedback.textContent = "Correct — the next term is " + series.answer + ".";
          } else {
            button.classList.add("wrong");
            grid.querySelectorAll(".option-btn").forEach(function (node) {
              if (Number(node.textContent) === series.answer) node.classList.add("correct");
            });
            feedback.className = "game-feedback bad";
            feedback.textContent = "The next term was " + series.answer + ".";
          }
          api.setScore((solved / 5) * 100);
          setTimeout(nextRound, 1050);
        });
        grid.appendChild(button);
      });
    }

    nextRound();
  };

  /* ------------------------------ init ------------------------------ */

  renderCards();
  renderStats();
})();

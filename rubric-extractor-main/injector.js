// DEBUG Decleration
const DEBUG = true;

/**
 * Prints out any arguments passed as long as `DEBUG` is set to true.
 * @param {any} item The thing to pass to `console.log()`.
 */
const debugPrint = function (item) {
    if (DEBUG) {
        console.log(item);
    }
}

//#region --- Download & Formatting ---

//#region - Download Functions -
/**
 * Code credit: StackOverflow - https://stackoverflow.com/a/77744147
 * @param {Blob} blob The blob to download.
 * @param {string} name The name of the file to be downloaded.
 */
let download = function (blob, name) {
    // Create a download link and trigger a click event to download the file
    var downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = name;
    downloadLink.click();
}

/**
 * Takes a string and turns it into a file for immediate download.
 * @param {string} mdString Markdown formatted string.
 */
let downloadMDTable = function (rubric) {
    let tablesMarkdownString = "# Rubric: " + rubric.rubricName + "\n\n";

    tablesMarkdownString += "### Total Points: " + rubric.getTotalPoints() + "\n\n";
    if (rubric.overallFeedback !== "") {
        tablesMarkdownString += `### Overall Feedback\n${rubric.overallFeedback}\n\n---\n\n`;
    }

    rubric.criteriaTables.forEach((criteriaGroup, index) => {
        let table = createMarkdownTable(criteriaGroup, index) + "\n\n";

        tablesMarkdownString += table;

        if (criteriaGroup.feedback !== "") {
            if (criteriaGroup.category == "Unnamed Group") {
                tablesMarkdownString += `> **Feedback:** ${criteriaGroup.feedback}`;
            } else {
                tablesMarkdownString += `> **Feedback:** ${criteriaGroup.feedback}`;
            }

            tablesMarkdownString += "\n\n---\n\n"
        } else {
            tablesMarkdownString += "---\n\n"
        }

    });

    debugPrint(tablesMarkdownString);
    let blob = new Blob([tablesMarkdownString], { type: "text/markdown" });

    download(blob, "BS-Rubric-Markdown.md"); // TODO: Name Formatting
}

/**
 * Takes a whole rubric and converts it into a JSON file immediately for download.
 * @param {Criteria} rubric The whole rubric to convert.
 * @returns {string} String of text formatted in JSON.
 */
let downloadJSON = function (rubric) {
    let tablesJSONString = JSON.stringify(rubric);

    debugPrint(tablesJSONString);
    let blob = new Blob([tablesJSONString]);

    download(blob, "BS-Rubric-JSON.json");
}
//#endregion

//#region - String Formatting -
/**
 * Takes a single criteria table (criteria group) and turns it into a markdown text table in string form.
 * @param {CriteriaTable} table The table of criterias to convert.
 * @returns {string} String of text formatted in Markdown.
 */
let createMarkdownTable = function (table, index) {
    let outputText;

    // Create Headers
    if (table.category == "Unnamed Group") {
        outputText = `|Group ${index + 1}|`;
    } else {
        outputText = `|${table.category}|`;
    }
    table.levels.forEach(level => {
        outputText += `${level.name}`

        if (level.scoringPoints != null) {
            outputText += ` - *points*: ${level.scoringPoints}`
        }

        outputText += `|`;
    });
    outputText += `Criterion Score|\n|`;

    // Markdown Table Decleration
    for (let i = 0; i < table.levels.length + 2; i++) { // Offset by 2 to account for group name & criterion score.
        outputText += `-|`;
    }

    // Criterias
    table.criterias.forEach(criteria => {
        outputText += `\n|`;
        outputText += `${criteria.name}|`;

        criteria.criteriaLevels.forEach(critLevel => {
            if (critLevel.isScoredLevel) {
                outputText += `**> ${critLevel.description} <**`;
            } else {
                outputText += `${critLevel.description}`;
            }

            if (critLevel.customPoints != null) {
                outputText += ` *(${critLevel.customPoints} points)*`
            }

            outputText += `|`;
        })

        let score = table.getScoreFromLevel(criteria.scoredLevel);
        outputText += `${score == null ? "" : score} / ${criteria.maxScore}`;
    })

    return outputText
}
//#endregion

//#endregion

//#region --- Data Gathering ---

/**
 * Unsure how reliable it is, but the expected format for points go as "# point(s)".
 * If we grab the position of where the whitespace character is, we can use
 * it as a cutoff point for the `.split()` string function.
 * @param {string} pointsString The text containing the points.
 * @returns {number} The interpreted number from the given text.
 */
let parsePoints = function (pointsString) {
    let spaceChar = pointsString.indexOf(" ");
    return Number(pointsString.slice(0, spaceChar));
}

/**
 * Similar to the function above, this should get the maximum
 * amount of points you can get from a specific criteria. (This is formatted as "/ #")
 * This instead takes the last whitespace char and splits from the end
 * @param {string} pointsString The text containing the points.
 * @returns {number} The interpreted number from the given text.
 */
let parseCriterionScore = function (scoreString) {
    let spaceChar = scoreString.lastIndexOf(" ");
    return Number(scoreString.slice(spaceChar));
}

/**
 * Takes data passed from the given `<tr>` and parses it into the `criteriaTable` object.
 * @param {NodeListOf<Element>} firstRowElementChildren `<tr>` element containing the criteria group levels.
 * @param {CriteriaTable} criteriaTable The `CriteriaTable` object to insert it into.
 */
let insertLevels = function (firstRowElementChildren, criteriaTable) {
    for (let index = 0; index < firstRowElementChildren.length; index++) {
        let th = firstRowElementChildren[index];

        // Skip Category Name
        if (!th.classList.contains("group-name") && !th.classList.contains("out-of")) {
            // First check if there's no points label. Some of the rubrics don't have them...
            if (th.children.length > 1) {
                let levelName = th.firstElementChild.textContent;
                let scoringPoints = parsePoints(th.lastElementChild.textContent);

                let level = new Level(levelName, scoringPoints);

                criteriaTable.levels.push(level);
            } else {
                let levelName = th.firstElementChild.textContent;
                let level = new Level(levelName, null);

                criteriaTable.levels.push(level);
            }
        }
    }
}

/**
 * Takes data from the passed `<tbody>` element and parses it into the `criteriaTable` object.
 * @param {Element} tableBody `<tbody>` element with the criterias.
 * @param {CriteriaTable} criteriaTable The `CriteriaTable` object to insert it into.
 */
let insertCriterias = function (tableBody, criteriaTable) {
    // Work through each row of the table's body.
    let tRows = tableBody.children; // List of `<tr>`s

    for (let index = 0; index < tRows.length; index++) {
        let criteria = new Criteria();
        // Get each cell of the row.
        let rowCells = tRows[index].children; // List of `<td>`s

        if (tRows[index].classList.contains("feedback-cell")) {
            let feedbackElement = tRows[index].firstElementChild.shadowRoot
                .querySelector("d2l-html-block").shadowRoot
                .firstElementChild;

            criteriaTable.feedback = feedbackElement.innerText;
        } else {
            // Main Loop
            for (let i = 0; i < rowCells.length; i++) {
                let cell = rowCells[i]; // `<td>` Children

                if (cell.classList.contains("criteria")) { // First `<td>` Handling
                    criteria.name = cell.innerText;
                } else if (cell.classList.contains("out-of")) { // Last `<td>` Handling
                    criteria.maxScore = parseCriterionScore(cell
                        .firstElementChild
                        .shadowRoot
                        .querySelector("#score-label-container")
                        .innerText);
                } else {
                    let cellDOM = cell.firstElementChild.shadowRoot;
                    let customPoints = null;
                    let scoredLevel = false;

                    // Indicate Scored Criteria Level
                    if (cell.classList.contains("selected")) {
                        criteria.scoredLevel = criteriaTable.levels[i - 1].name; // Offset by one to correspond with levels array.
                        scoredLevel = true;
                    }

                    // Description Extraction
                    let description = cellDOM
                        .querySelector("d2l-html-block")
                        .shadowRoot
                        .querySelector(".d2l-html-block-rendered")
                        .innerText;

                    // Points Extraction (if applicable)
                    let pointsText = cellDOM.querySelector(".custom-points");
                    if (pointsText) {
                        customPoints = parsePoints(pointsText.innerText);
                    }

                    criteria.criteriaLevels.push(new CriteriaLevel(description, customPoints, scoredLevel));
                }
            }

            criteriaTable.criterias.push(criteria);
        }
    }
}

/**
 * The main function that takes the given `<table>` to begin processing it into usable data.
 * @param {Element} tableElement `<table>` element to extract criteria information from.
 * @returns {CriteriaTable} A new `CriteriaTable` from the given table.
 */
let extractTable = function (tableElement) {
    let criteriaTable;
    let categoryText;
    let firstRow;
    let tableBody;

    // Gather criteria category name & instantiate new CriteriaTable
    //  <table>
    //      <thead>
    //          <tr>
    //              <th> <-- First `<th>` usually is the category name.
    //category = tableElement.firstElementChild.firstElementChild.firstElementChild.textContent;
    categoryText = tableElement.querySelector(".group-name").textContent;
    if (categoryText == "Criteria") { categoryText = "Unnamed Group" }
    criteriaTable = new CriteriaTable(categoryText);

    // Insert Levels (first row of table)
    //  <table>
    //      <thead>
    //          <tr>
    //firstRow = tableElement.querySelector(".d2l-table-row-first").children;
    firstRow = tableElement // For some reason, using a `querySelector()` crashes if the user doesn't scroll through the whole rubric first.
        .firstElementChild
        .firstElementChild
        .children;
    insertLevels(firstRow, criteriaTable);

    // Insert Critierias
    tableBody = tableElement.querySelector("tbody");
    insertCriterias(tableBody, criteriaTable);

    return criteriaTable;
}

/**
 * Main Function - Gets the `<table>` elements and start extracting data and downloads it.
 */
let extract = function (method) {
    let tableElements = [];
    let rubrics = [];
    let overallFeedbackElement = document.querySelector(".feedback-container d2l-html-block");
    let rubricElement = document.querySelector("d2l-rubric").shadowRoot;
    let rubric = new Rubric();

    // Gather Overall Feedback
    if (overallFeedbackElement) {
        rubric.overallFeedback = overallFeedbackElement.shadowRoot.firstElementChild.innerText;
    }

    // Get a list of the rubrics.
    rubrics = rubricElement
        .querySelector("d2l-rubric-adapter d2l-rubric-criteria-groups").shadowRoot
        .querySelectorAll("d2l-rubric-criteria-group");

    // Loop through the list, actually getting the table elements from the criteria groups.
    for (let index = 0; index < rubrics.length; index++) {
        const element = rubrics[index];
        tableElements[index] = element.shadowRoot.querySelector("d2l-table-wrapper table");
    }

    // Data Extraction - Rubric Name
    rubric.rubricName = rubricElement.firstElementChild.attributes["rubric-name"].value;

    // Data Extraction - Critierias
    tableElements.forEach(function (tableElement) {
        // Extract & Insert
        debugPrint(tableElement);
        rubric.push(extractTable(tableElement));
    });

    debugPrint(tableElements);
    debugPrint(rubric);

    switch (method) {
        case "markdown-table":
            downloadMDTable(rubric)
            break;
        case "json":
            downloadJSON(rubric)
            break;

        default:
            break;
    }

}

//#endregion

/**
 * Puts the extractor ui in the webpage. Is ran only once when the extension's popup is clicked.
 * From then on, the app is "closed" by hiding it from view.
 */
const injectExtractor = function () {
    /**
     * Sees whether or not there's an non-compact Brightspace rubric and toggle's the app's
     * download button.
     */
    const detectRubric = function () {
        let downloadButton = document.querySelector(".extractor-download");
        let noRubricMessage = document.querySelector(".no-rubric-msg");
        
        // If the page is small enough, Brightspace reloads the rubric with a different document structure :P
        // This basically checks if that is the case right now.
        let rubric = document.querySelector("d2l-rubric");
        let compact = rubric.shadowRoot.querySelector("d2l-rubric-criteria-groups").attributes["compact"];

        if (!compact) {
            downloadButton.classList.remove("d-none");
            noRubricMessage.classList.add("d-none");
        } else {
            downloadButton.classList.add("d-none");
            noRubricMessage.classList.remove("d-none");
        }
    }

    debugPrint('Injecting...')

    // Add HTML
    document.querySelector("body").insertAdjacentHTML("beforeend", `
        <div class="extractor-toast fixed-top border mx-auto mt-3 py-2 px-3 rounded-5">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap-utilities.min.css" />
            <button class="extractor-close btn position-absolute top-50 translate-middle p-1 bg-danger rounded-pill">
                <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" class="bi bi-x position-absolute translate-middle"
                    viewBox="0 0 16 16">
                    <path
                        d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
                </svg>
            </button>
            <div class="extractor-body d-flex justify-content-between">
                <h1><span class="bs">BS</span> <i>Extractor</i></h1>
                <button role="button" class="d-none extractor-download btn btn-primary rounded-pill">Download!</button>
                <p class="no-rubric-msg text-body-tertiary">No rubric detected...</p>
            </div>
            <select name="format" id="format" class="extractor-select position-absolute top-50 form-select rounded-pill">
                <option value="markdown-table" class="">Table &gt; Markdown</option>
                <!--option value="markdown-list">Bulleted List &gt; Markdown</option-->
                <option value="json">JSON</option>
                <!--option value="csv">CSV</option-->
            </select>
        </div>`
    );

    let rubric = document.querySelector("d2l-rubric");

    // Attach Mutation Observer if there's a rubric element at all. Also check if the rubric
    // is in compact mode or not. The app can't read a compact version of the rubric yet.
    if (rubric) {
        let rubricObserver = new MutationObserver(detectRubric);
        rubricObserver.observe(rubric.shadowRoot, { childList: true, subtree: true, attributes: true });
        
        detectRubric();
    }

    // Add Listeners
    document.querySelector(".extractor-close").addEventListener("click", () => {
        document.querySelector(".extractor-toast").classList.toggle("d-none");
    });
    document.querySelector(".extractor-download").addEventListener("click", () => {
        let method = document.getElementById("format").value;
        extract(method);
    })
}

// Activation Routine
debugPrint("BS Rubric Injector loaded.");

chrome.runtime.onMessage.addListener(function (message) {
    let extractor = document.querySelector(".extractor-toast");
    
    if (message.activateBSExtractor && !extractor) {
        injectExtractor();
    } else if (extractor) {
        extractor.classList.toggle("d-none");
    }
}
)

//#region --- Classes (See diagram for structure.) ---

/**
 * The main object that represents a whole criteria group table.
 */
class CriteriaTable {
    /**
     * Instantiate new `CriteriaTable` object.
     * @param {string} categroyName The name of the criteria group. 
     */
    constructor(categroyName = "Unknown") {
        this.category = categroyName;
        this.feedback = "";
        this.levels = [];
        this.criterias = [];
    }

    /**
     * Tallies all the max scores from the criteria.
     * @returns {number} The maximum amount of points that can be scored from the criteria group.
     */
    getMaxPoints = function () {
        let max = 0;
        this.criterias.forEach(criteria => {
            max += criteria.maxScore
        });
        return max;
    }

    /**
     * Gets the points earned from the desired level name within the criteria table.
     * @param {string} levelName The name of the level to get from.
     * @returns The number of points earned from the level. Returns `null` if the level is not found.
     */
    getScoreFromLevel = function (levelName) {
        let score = null;

        this.levels.forEach((level) => {
            if (level.name == levelName) {
                score = level.scoringPoints;
            }
        })

        return score;
    }
}

/**
 * The levels the critieria group can have as well as how much points each give.
 */
class Level {
    /**
     * Instantiate new `Level` object.
     * @param {string} levelName The name of the level, e.g. "Level 1".
     * @param {number} points The amount of points the level is worth.
     */
    constructor(levelName, points = null) {
        this.name = levelName;
        this.scoringPoints = points;
    }
}

/**
 * A criteria within the group.
 */
class Criteria {
    /**
     * Instantiate new `Criteria` object.
     * @param {string} criteriaName The name of the criteria.
     * @param {number} criterionScore The total points.
     */
    constructor(criteriaName, criterionScore, scoredLevel = null) {
        this.name = criteriaName;
        this.maxScore = criterionScore;
        this.scoredLevel = scoredLevel
        this.criteriaLevels = [];
    }
}

/**
 * A level within a `Criteria` object. Has a description and an amount of points if given.
 */
class CriteriaLevel {
    /**
     * Instantiate new `CriteriaLevel` object.
     * @param {string} description A description the level's expected performance.
     * @param {number} customPoints The amount of points to be given (if specified).
     */
    constructor(description, customPoints = null, isScoredLevel = false) {
        this.description = description;
        this.customPoints = customPoints;
        this.isScoredLevel = isScoredLevel;
    }
}

/**
 * An object representing the whole rubric. Access the criteria groups within with `.criteriaTables`.
 */
class Rubric {
    /**
     * Instantiate new `Rubric` object.
     * @param {string} rubricName The name of the rubric itself.
     */
    constructor(rubricName = "") {
        this.rubricName = rubricName;
        this.overallFeedback = "";
        this.criteriaTables = [];
    }

    /**
     * Insert to the list directly from the rubric instead of from `Rubric.criteriaTables`.
     * @param {CriteriaTable} criteriaTable The `CriteriaTable` object to insert.
     */
    push = function (criteriaTable) {
        this.criteriaTables.push(criteriaTable)
    }

    /**
     * The total score of the whole rubric; adding up all the max scores of each criteria group.
     */
    getTotalPoints = function () {
        let total = 0;

        this.criteriaTables.forEach((criteriaTable) => {
            total += criteriaTable.getMaxPoints();
        })

        return total;
    }
}

//#endregion
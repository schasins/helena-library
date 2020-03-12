import { RelationFinder } from "./relation_finding";
import { XPath } from "../utils/xpath";

/**
 * Methods for selecting a next/pagination button on a page.
 */
export namespace NextButtonSelector {
  export interface Interface {
    id: string;
    class: string;
    src: string | null;
    frame_id: string | null;
    tag: string;
    text: string | null;
    xpath: string;
  }

  export let listeningForNextButtonClick = false;
  /**
   * Activate state of listening for a click on the next button.
   */
  export function listenForNextButtonClick() {
    // ok, now we're listening for a next button click
    listeningForNextButtonClick = true;
    unhighlightNextButton(); // unhighlight existing one if present
    
    // in case the highlighting of cells blocks the next button, hide this
    RelationFinder.clearCurrentSelectorHighlight(); 
  }

  /**
   * Records the event target as the next button by sending information about it
   *   to the mainpanel.
   * @param event the click event
   */
  export function record(event: MouseEvent) {
    listeningForNextButtonClick = false;

    event.stopPropagation();
    event.preventDefault();

    if (!event.target) {
      throw new ReferenceError('Event has no target!');
    }
    
    let nextOrMoreButton = <HTMLElement> event.target;
    let data: NextButtonSelector.Interface = {
      tag: nextOrMoreButton.tagName,
      text: nextOrMoreButton.textContent,
      id: nextOrMoreButton.id,
      class: nextOrMoreButton.className,
      src: nextOrMoreButton.getAttribute('src'),
      xpath: <string> XPath.fromNode(nextOrMoreButton),
      frame_id: SimpleRecord.getFrameId()
    }
    
    window.utilities.sendMessage("content", "mainpanel", "nextButtonSelector",
      { selector: data }
    );
    highlightNextButton(data);

    RelationFinder.highlightCurrentSelector(); // rehighlight the relaiton items
  }

  /**
   * Determines whether a candidate element is a promising next button
   * @param nextSelector selector for the next button
   * @param candEl the candidate element to check
   * @param priorPageIndexText if traversing to pagination, the string of the
   *   last page index clicked
   */
  function isPromisingNextButton(nextSelector: NextButtonSelector.Interface,
    candEl: HTMLElement, priorPageIndexText?: string) {
    // either there's an actual image and it's the same, or the text is the same
    if (nextSelector.src) {
      return (candEl.getAttribute('src') === nextSelector.src);
    }
    if (!priorPageIndexText || isNaN(+priorPageIndexText)) {
      // we don't have a past next button or the past next button wasn't numeric
      //   so just look for the exact text
      return (candEl.textContent === nextSelector.text);
    } else {
      // it was a number!  so we're looking for the next number bigger than this
      //   one...
      // oh cool, there's been a prior next button, and it had a number text
      //   we'd better look for a button like it but that has a bigger number...
      // todo: make this more robust
      let prior = parseInt(priorPageIndexText);
      let currNodeText = candEl.textContent;
      if (!currNodeText) {
        throw new ReferenceError('Current element has no textContent.');
      }
      if (isNaN(+currNodeText)){
        return false;
      }
      let curr = parseInt(currNodeText);
      if (curr > prior){
        return true;
      }
    }
    return false;
  }

  /**
   * Finds the next button for the current page given a next button selector.
   * @param selector next button selector
   * @param priorPageIndexText if page button, a string indicating the number of
   *   the last page index
   */
  export function findNextButton(selector: NextButtonSelector.Interface,
    priorPageIndexText?: string): HTMLElement | null {
    window.WALconsole.log(selector);

    let next_or_more_button_text = selector.text;
    let candButtons = [].slice.call(
      document.querySelectorAll(selector.tag)
    );
    candButtons = candButtons.filter((button: HTMLElement) =>
      isPromisingNextButton(selector, button, priorPageIndexText)
    );
    window.WALconsole.namedLog("findNextButton", "candidate_buttons",
      candButtons);

    let doNumberVersion = priorPageIndexText && !isNaN(+priorPageIndexText);

    // hope there's only one button
    if (candButtons.length === 1 && !doNumberVersion) {
      window.WALconsole.namedLog("findNextButton", "only one button");
      return candButtons[0];
    }
    
    // if not and demo button had id, try using the id
    if (selector.id && selector.id !== "" && !doNumberVersion) {
      window.WALconsole.namedLog("findNextButton", "we had an id")
      let idElement = document.getElementById(selector.id);
      if (idElement) {
        return idElement;
      }
    }

    // if not and demo button had class, try using the class
    let cbuttons = candButtons.filter((cand: HTMLElement) => 
      cand.className === selector.class);
    if (cbuttons.length === 1 && !doNumberVersion) {
      window.WALconsole.namedLog("findNextButton",
        "filtered by class and there was only one");
      return cbuttons[0];
    }
    // ok, another case where we probably want to decide based on sharing class
    // is the case where we have numeric next buttons
    let lowestNodeSoFar = null
    if (priorPageIndexText && !isNaN(+priorPageIndexText)) {
      window.WALconsole.namedLog("findNextButton",
        "filtered by class and now trying to do numeric");
      
      // let's go through and just figure out which one has the next highest number relative to the prior next button text
      let lsToSearch = cbuttons;
      if (cbuttons.length < 1) {
        lsToSearch = candButtons;
      }
      let priorButtonNum = parseInt(priorPageIndexText);
      let lowestNumSoFar = Number.MAX_VALUE;
      window.WALconsole.namedLog("findNextButton", "potential buttons",
        lsToSearch);
      for (const button of lsToSearch) {
        let buttonText = button.textContent;
        console.log("button", button, buttonText);
        var buttonNum = parseInt(buttonText);
        console.log("comparison", buttonNum, lowestNumSoFar, priorButtonNum,
          buttonNum < lowestNumSoFar, buttonNum > priorButtonNum);
        if (buttonNum < lowestNumSoFar && buttonNum > priorButtonNum){
          lowestNumSoFar = buttonNum;
          lowestNodeSoFar = button;
        }
      }
    }

    if (lowestNodeSoFar) {
      window.WALconsole.namedLog("findNextButton", "numeric worked");
      return lowestNodeSoFar;
    } else {
      //see which candidate has the right text and closest xpath
      let min_distance = 999999;
      let min_candidate = null;
      for (const candButton of candButtons) {
        let candXPath = XPath.fromNode(candButton);
        let distance = window.MiscUtilities.levenshteinDistance(candXPath,
          selector.xpath);
        if (distance < min_distance){
          min_distance = distance;
          min_candidate = candButton;
        }
      }
      if (min_candidate === null) {
        window.WALconsole.log("couldn't find an appropriate 'more' button");
        window.WALconsole.log(selector.tag, selector.id,
          next_or_more_button_text, selector.xpath);
      }
      return min_candidate;
    }
  }

  let nextOrMoreButtonHighlight: JQuery<HTMLElement> | null = null;
  /**
   * Highlights the next button given by the selector.
   * @param selector the next button selector
   */
  export function highlightNextButton(selector: NextButtonSelector.Interface) {
    window.WALconsole.log(selector);
    let button = findNextButton(selector);
    nextOrMoreButtonHighlight = window.Highlight.highlightNode(button,
      "#E04343", true);
  }

  /**
   * Clears highlighted next button, if any.
   */
  export function unhighlightNextButton() {
    if (nextOrMoreButtonHighlight !== null) {
      window.Highlight.clearHighlight(nextOrMoreButtonHighlight);
    }
  }
}
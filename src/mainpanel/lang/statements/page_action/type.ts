import * as Blockly from "blockly";

import { HelenaMainpanel, NodeSources } from "../../../helena_mainpanel";

import { StatementTypes } from "../statement_types";

import { NodeVariable } from "../../../variables/node_variable";
import { NodeVariableUse } from "../../values/node_variable_use";

import { Concatenate } from "../../values/concatenate";
import { String } from "../../values/string";
import { PageActionStatement } from "./page_action";
import { EventMessage } from "../../../../common/messages";
import { ColumnSelector } from "../../../../content/selector/column_selector";
import { MainpanelNode } from "../../../../common/mainpanel_node";
import { GenericRelation } from "../../../relation/generic";
import { PageVariable } from "../../../variables/page_variable";
import { RunObject, RunOptions, HelenaProgram } from "../../program";

/**
 * Statement representing a user taking the action of typing something.
 */
export class TypeStatement extends PageActionStatement {
  public currentTypedString: String | Concatenate | NodeVariableUse | null;
  public keyCodes: number[];
  public keyEvents: EventMessage[];
  public onlyKeydowns: boolean;
  public onlyKeyups: boolean;
  public outputPageVars?: PageVariable[];
  public pageUrl?: string;
  public typedString?: string;
  public typedStringLower?: string;
  public typedStringParameterizationRelation?: GenericRelation;

  constructor(trace: EventMessage[]) {
    super();
    window.Revival.addRevivalLabel(this);
    this.setBlocklyLabel("type");
    this.trace = trace;
    this.cleanTrace = HelenaMainpanel.cleanTrace(trace);

    // find the record-time constants that we'll turn into parameters
    const ev = HelenaMainpanel.firstVisibleEvent(trace);
    this.pageVar = window.EventM.getDOMInputPageVar(ev);
    this.node = ev.target.xpath;
    this.pageUrl = ev.frame.topURL;
    // var acceptableEventTypes = HelenaMainpanel.statementToEventMapping.keyboard;
    const textEntryEvents = trace.filter((ev) => {
      const sType = HelenaMainpanel.statementType(ev);
      return (sType === StatementTypes.KEYBOARD);
              // || sType === StatementTypes.KEYUP);
    });

    if (textEntryEvents.length > 0) {
      const lastTextEntryEvent = textEntryEvents[textEntryEvents.length - 1];
      this.typedString = lastTextEntryEvent.target.snapshot.value;
      if (!this.typedString) {
        this.typedString = "";
      }
      this.typedStringLower = this.typedString.toLowerCase(); 
    }

    // any event in the segment may have triggered a load
    const domEvents = trace.filter((ev) => ev.type === "dom");

    const outputLoads = domEvents.reduce(
      (acc, ev) => acc.concat(window.EventM.getDOMOutputLoadEvents(ev)
    ), []);
    this.outputPageVars = outputLoads.map(
      (ev) => window.EventM.getLoadOutputPageVar(ev)
    );

    // for now, assume the ones we saw at record time are the ones we'll want at
    //   replay
    this.currentNode = HelenaMainpanel.makeNodeVariableForTrace(trace);
    this.origNode = this.node;
    this.currentTypedString = new String(this.typedString);

    // we want to do slightly different things for cases where the typestatement only has keydowns or only has keyups (as when ctrl, shift, alt used)
    const onlyKeydowns = textEntryEvents.every(
      (event) => event.data.type === "keydown"
    );
    if (onlyKeydowns) {
      this.onlyKeydowns = true;
    }
    const onlyKeyups = textEntryEvents.every(
      (event) => event.data.type === "keyup"
    );
    if (onlyKeyups) {
      this.onlyKeyups = true;
    }

    if (onlyKeydowns || onlyKeyups) {
      this.keyEvents = textEntryEvents;
      this.keyCodes = this.keyEvents.map((ev) => <number> ev.data.keyCode);
    }
  }

  public getOutputPagesRepresentation() {
    let prefix = "";
    if (this.hasOutputPageVars()) {
      prefix = this.outputPageVars?.map(
        (pv) => pv.toString()
      ).join(", ") + " = ";
    }
    return prefix;
  }

  public prepareToRun() {
    // TODO: cjbaik: is there a case where currentNode is not NodeVariable?
    if (this.currentNode instanceof NodeVariable) {
      const feats = this.currentNode.getRequiredFeatures();
      this.requireFeatures(feats);
    }
  }

  public stringRep() {
    let stringRep = "";
    if (this.currentTypedString instanceof Concatenate) {
      stringRep = this.currentTypedString.toString();
    } else if (this.currentTypedString instanceof String) {
      stringRep = <string> this.currentTypedString.getCurrentVal();
    }
    return stringRep;
  }

  public toStringLines(): string[] {
    if (!this.onlyKeyups && !this.onlyKeydowns) {
      // normal processing, for when there's actually a typed string
      const stringRep = this.stringRep();
      const pageVarStr = this.pageVar? this.pageVar.toString() : "undefined";
      return [
        `${this.getOutputPagesRepresentation()}type(${pageVarStr}, ${stringRep})`
      ];
    } else {
      return [];
      /*
      var charsDict = {16: "SHIFT", 17: "CTRL", 18: "ALT", 91: "CMD"}; // note that 91 is the command key in Mac; on Windows, I think it's the Windows key; probably ok to use cmd for both
      var chars = [];
      _.each(this.keyEvents, function(ev) {
        if (ev.data.keyCode in charsDict) {
          chars.push(charsDict[ev.data.keyCode]);
        }
      });
      var charsString = chars.join(", ");
      var act = "press"
      if (this.onlyKeyups) {
        act = "let up"
      }
      return [act + " " + charsString + " on " + this.pageVar.toString()];
      */
    }
  }


  public updateBlocklyBlock(program?: HelenaProgram,
      pageVars?: PageVariable[], relations?: GenericRelation[]) {
    if (!program || !pageVars) {
      return;
    }
    // addToolboxLabel(this.blocklyLabel, "web");
    const pageVarsDropDown = HelenaMainpanel.makePageVarsDropdown(pageVars);
    Blockly.Blocks[this.blocklyLabel] = {
      init: function(this: Blockly.Block) {
        this.appendDummyInput()
            .appendField("type");
        this.appendValueInput("currentTypedString");
        this.appendDummyInput()
            .appendField("in")
            .appendField(new Blockly.FieldDropdown(pageVarsDropDown), "page");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(280);
      }
    };
  }

  public genBlocklyNode(prevBlock: Blockly.Block,
      workspace: Blockly.WorkspaceSvg) {
    if (this.onlyKeyups || this.onlyKeydowns ||
       (this.currentTypedString &&
          (this.currentTypedString instanceof String ||
             this.currentTypedString instanceof Concatenate) &&
          !this.currentTypedString.hasText())) {
      return null;
    } else {
      this.block = workspace.newBlock(this.blocklyLabel);
      
      const pageVarStr = this.pageVar? this.pageVar.toString() : "undefined";
      this.block.setFieldValue(pageVarStr, "page");
      HelenaMainpanel.attachToPrevBlock(this.block, prevBlock);
      HelenaMainpanel.setHelenaStatement(this.block, this);

      if (this.currentTypedString) {
        HelenaMainpanel.attachToInput(this.block,
          this.currentTypedString.genBlocklyNode(this.block, workspace),
          "currentTypedString");
      }

      return this.block;
    }
  }

  public getHelena() {
    const currentTypedString = this.block.getInput('currentTypedString')
      .connection.targetBlock();
    if (currentTypedString) {
      this.currentTypedString =
        <String | Concatenate> HelenaMainpanel.getHelenaStatement(currentTypedString).
          getHelena();
    } else {
      this.currentTypedString = null;
    }
    return this;
  };

  public traverse(fn: Function, fn2: Function) {
    fn(this);
    if (this.currentTypedString) {
      this.currentTypedString.traverse(fn, fn2);
    }
    fn2(this);
  }

  public pbvs() {
    const pbvs = [];
    if (this.currentTab()) {
      // do we actually know the target tab already?  if yes, go ahead and
      //   paremterize that
      pbvs.push({
        type: "tab",
        value: this.originalTab()
      });
    }
    
    // we only want to pbv for things that must already have been extracted by
    //   relation extractor
    if (this.currentNode instanceof NodeVariable &&
        this.currentNode.getSource() === NodeSources.RELATIONEXTRACTOR) {
      pbvs.push({
        type: "node",
        value: this.node
      });
    }

    if (this.typedString !== this.stringRep()) {
      if (this.typedString && this.typedString.length > 0) {
        pbvs.push({
          type: "typedString",
          value: this.typedString
        });
      }
    }
    return pbvs;
  }

  public parameterizeForString(relation: GenericRelation,
      column: ColumnSelector.Interface, nodeRep: MainpanelNode.Interface,
      string?: string) {
    if (string === null || string === undefined) {
      // can't parameterize for a cell that has null text
      return;
    }
    const textLower = string.toLowerCase();
    const startIndex = this.typedStringLower?.indexOf(textLower);
    if (startIndex && startIndex > -1) {
      // cool, this is the column for us then
      this.relation = relation;
      this.columnObj = column;
      const name = column.name;

      if (!name) {
        throw new ReferenceError("Column has no name.");
      }

      const components = [];
      const left = string.slice(0, startIndex);
      if (left.length > 0) {
        components.push(new String(left));
      }

      const nodevaruse = new NodeVariableUse(
        HelenaMainpanel.getNodeVariableByName(name)
      );
      components.push(nodevaruse);

      const right = string.slice(startIndex +
        (<string> this.typedString).length, string.length);
      if (right.length > 0) {
        components.push(new String(right));
      }

      let finalNode = null;
      if (components.length == 1) {
        finalNode = components[0];
      } else if (components.length == 2) {
        finalNode = new Concatenate(components[0], components[1]);
      } else if (components.length === 3) {
        finalNode = new Concatenate(components[0],
          new Concatenate(components[1], components[2]));
      }
      this.currentTypedString = finalNode;
      this.typedStringParameterizationRelation = relation;
      return true;
    }
    return false;
  }

  public parameterizeForRelation(relation: GenericRelation) {
    if (!this.pageVar) {
      throw new ReferenceError("Page variable not set.");
    }
  
    const relationColumnUsed = this.parameterizeNodeWithRelation(relation,
      this.pageVar);

    if (!this.onlyKeydowns && !this.onlyKeyups) {
      // now let's also parameterize the text
      const columns = relation.columns;
      const firstRowNodeReprs = relation.firstRowNodeRepresentations();
      for (let i = 0; i < columns.length; i++) {
        const text = columns[i].firstRowText;
        const paramed = this.parameterizeForString(relation, columns[i],
          firstRowNodeReprs[i], text);
        if (paramed) {
          return [relationColumnUsed, columns[i]];
        }
      }
    }

    return [relationColumnUsed];
  }
  
  public unParameterizeForRelation(relation: GenericRelation) {
    this.unParameterizeNodeWithRelation(relation);
    if (this.typedStringParameterizationRelation === relation) {
      this.currentTypedString = new String(this.typedString);
    }
  }

  public run(runObject: RunObject, rbbcontinuation: Function,
      rbboptions: RunOptions) {
    if (this.currentTypedString) {
      this.currentTypedString.run(runObject, rbbcontinuation, rbboptions);
    }
  }

  public args(environment: EnvironmentPlaceholder) {
    const args = [];

    // we only want to pbv for things that must already have been extracted by
    //   relation extractor
    if (this.currentNode instanceof NodeVariable &&
        this.currentNode.getSource() === NodeSources.RELATIONEXTRACTOR) {
      args.push({
        type:"node",
        value: this.currentNodeXpath(environment)
      });
    }
    args.push({
      type: "typedString",
      value: this.stringRep()
    });
    args.push({
      type: "tab",
      value: this.currentTab()
    });
    return args;
  };

  public currentRelation() {
    return this.relation;
  }

  public currentColumnObj() {
    return this.columnObj;
  }

  public hasOutputPageVars() {
    return !!(this.outputPageVars && this.outputPageVars.length > 0);
  }
}

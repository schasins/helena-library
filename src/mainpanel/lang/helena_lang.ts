import * as Blockly from "blockly";

import { ColumnSelector } from "../../content/selector/column_selector";

import { GenericRelation } from "../relation/generic";

import { PageVariable } from "../variables/page_variable";
import { StatementContainer } from "./statements/container";
import { PageActionStatement } from "./statements/page_action/page_action";
import { LoadStatement } from "./statements/browser/load";
import { RunObject, RunOptions, HelenaProgram } from "./program";
import { ClickStatement } from "./statements/page_action/click";
import { TypeStatement } from "./statements/page_action/type";
import { HelenaMainpanel } from "../helena_mainpanel";
import { Revival } from "../revival";

export type RingerStatement = (PageActionStatement | LoadStatement);
export type OutputPageVarStatement = (LoadStatement | ClickStatement |
  TypeStatement);

export interface StatementParameter {
  type: string;
  value: any;
}

export class HelenaLangObject implements Revival.Revivable {
  public ___revivalLabel___: string;

  public block: Blockly.Block;
  public blocklyLabel: string;
  public invisibleHead?: HelenaLangObject[];
  public invisibleTail?: HelenaLangObject[];
  public nullBlockly?: boolean;

  public parent: StatementContainer;

  public clearRunningState() {
    return;
  }

  public genBlocklyNode(prevBlock: Blockly.Block | null,
    workspace: Blockly.WorkspaceSvg): Blockly.Block | null {
      return null;
  }

  public getHelena() {
    return this;
  }

  public hasOutputPageVars() {
    return false;
  }

  /**
   * Returns whether this Helena statement is Ringer based.
   */
  public isRingerBased() {
    return false;
  }

  public prepareToRun() {
    return;
  }

  public remove() {
    this.parent.removeChild(this);
  }

  /**
   * Run this Helena statement.
   * @param runObject 
   * @param rbbcontinuation run basic block continuation
   * @param rbboptions run basic block options
   */
  public run(runObject: RunObject, rbbcontinuation: Function,
    rbboptions: RunOptions) {
      return;
  }

  public setBlocklyLabel(label: string) {
    //console.log("setBlocklyLabel", obj, label, obj.___revivalLabel___);
    this.blocklyLabel = label;

    // it's important that we keep track of what things within the
    //   HelenaMainpanel object are blocks and which aren't
    // this may be a convenient way to do it, since it's going to be obvious if
    //   you introduce a new block but forget to call this whereas if you
    //   introduce a new function and forget to add it to a blacklist, it'll get
    //   called randomly, will be hard to debug
    const name = this.___revivalLabel___;
    HelenaMainpanel.blocklyNames.push(name);
    HelenaMainpanel.blocklyNames = [...new Set(HelenaMainpanel.blocklyNames)];
  }

  public toStringLines() {
    return [""];
  }

  public traverse(fn: Function, fn2: Function) {
    fn(this);
    fn2(this);
  }

  public updateBlocklyBlock(program?: HelenaProgram,
      pageVars?: PageVariable[], relations?: GenericRelation[]) {
    return;
  }

  public parameterizeForRelation(relation: GenericRelation):
      (ColumnSelector.Interface | null)[] {
    return [];
  }

  public unParameterizeForRelation(relation: GenericRelation) {
    return;
  }
}
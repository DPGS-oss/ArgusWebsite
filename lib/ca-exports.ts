/**
 * Re-exports Cloud Functions CA exporters so unit tests run the same code
 * apiCa serves. Source of truth: functions/_shared/ca-exports.js
 *
 * Builds GSTN GSTR-1 offline-tool JSON and TallyPrime XML from stored invoice
 * fields. Does not file returns, mint IRNs, or push to Tally localhost:9000.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const impl = require("../functions/_shared/ca-exports.js") as {
  buildGstr1Json: (input: { gstin: string; month: string; invoices: unknown[] }) => Gstr1Json;
  buildTallyXml: (input: { companyName: string; month: string; invoices: unknown[] }) => string;
  sellerGstinFromAppData: (appData: unknown) => string;
  companyNameFromAppData: (appData: unknown) => string;
  currentMonthYm: (now?: Date) => string;
  parseMonthParam: (value: unknown, now?: Date) => string;
  monthBounds: (month: string, now?: Date) => { from: string; to: string; fp: string; month: string };
};

export type Gstr1ItemDet = {
  rt: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
};

export type Gstr1Inv = {
  inum: string;
  idt: string;
  val: number;
  pos: string;
  rchrg: "Y" | "N";
  inv_typ: string;
  itms: Array<{ num: number; itm_det: Gstr1ItemDet }>;
};

export type Gstr1Json = {
  gstin: string;
  fp: string;
  gt: number;
  cur_gt: number;
  b2b: Array<{ ctin: string; inv: Gstr1Inv[] }>;
  b2cl: Array<{ pos: string; inv: Gstr1Inv[] }>;
  b2cs: Array<{
    sply_ty: "INTER" | "INTRA";
    pos: string;
    typ: string;
    rt: number;
    txval: number;
    iamt: number;
    camt: number;
    samt: number;
    csamt: number;
  }>;
  cdnr: Array<{
    ctin: string;
    nt: Array<{
      ntty: "C" | "D";
      nt_num: string;
      nt_dt: string;
      val: number;
      pos: string;
      rchrg: "Y" | "N";
      inv_typ: string;
      itms: Array<{ num: number; itm_det: Gstr1ItemDet }>;
    }>;
  }>;
  hsn: {
    data: Array<{
      num: number;
      hsn_sc: string;
      desc: string;
      uqc: string;
      qty: number;
      rt: number;
      txval: number;
      iamt: number;
      camt: number;
      samt: number;
      csamt: number;
    }>;
  };
  doc_issue: {
    doc_det: Array<{
      doc_num: number;
      doc_typ: string;
      docs: Array<{ num: number; from: string; to: string; totnum: number; cancel: number; net_issue: number }>;
    }>;
  };
};

export const buildGstr1Json = impl.buildGstr1Json;
export const buildTallyXml = impl.buildTallyXml;
export const sellerGstinFromAppData = impl.sellerGstinFromAppData;
export const companyNameFromAppData = impl.companyNameFromAppData;
export const currentMonthYm = impl.currentMonthYm;
export const parseMonthParam = impl.parseMonthParam;
export const monthBounds = impl.monthBounds;

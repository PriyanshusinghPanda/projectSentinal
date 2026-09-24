"""Build slim cached copies of the big CSVs (only the columns the investigator uses)."""
import csv, os, pickle, time
D = os.path.join(os.path.dirname(__file__), "..", "data")
T_COLS = ["TransactionID","TransactionDT","TransactionAmt","ProductCD","card1","card2","card3","card4","card5","card6","addr1","addr2","dist1","P_emaildomain","R_emaildomain","M1","M2","M3","M4","M5","M6","M7","M8","M9","customer_id","ts","channel","risk_score","C1","C13","D1","D15"]
I_COLS = ["TransactionID","id_15","id_23","id_30","id_31","id_33","DeviceType","DeviceInfo","id_19","id_20"]
t0=time.time()
def slim(fn, cols):
    rows=[]
    with open(os.path.join(D,fn), newline="") as f:
        r=csv.reader(f); h=next(r); idx=[h.index(c) for c in cols]
        for row in r: rows.append(tuple(row[i] for i in idx))
    return rows
tx=slim("transactions.csv",T_COLS); print("tx",len(tx),time.time()-t0)
idn=slim("identity.csv",I_COLS); print("id",len(idn),time.time()-t0)
pickle.dump({"T_COLS":T_COLS,"I_COLS":I_COLS,"tx":tx,"id":idn}, open(os.path.join(os.path.dirname(__file__),"slim.pkl"),"wb"))

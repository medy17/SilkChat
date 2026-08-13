import type { analyzeCircuitInputSchema } from "@/lib/electrical-engineering"
import type { z } from "zod"

type AnalyzeCircuitInput = z.infer<typeof analyzeCircuitInputSchema>

export const buildElectricalSolverProgram = (input: AnalyzeCircuitInput) => {
    const payload = JSON.stringify({ circuit: input.circuit, analysis: input.analysis })

    return String.raw`
import cmath, json, math, re
import numpy as np
import sympy as sp
from pint import UnitRegistry

payload = json.loads(${JSON.stringify(payload)})
circuit = payload["circuit"]
analysis = payload["analysis"]
ureg = UnitRegistry()

class CircuitError(Exception):
    def __init__(self, code, message, affected=None):
        super().__init__(message)
        self.code, self.affected = code, affected or []

def quantity(text, unit):
    raw = str(text).strip().replace("µ", "u").replace("Ω", "ohm")
    try:
        match = re.fullmatch(r"([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([kMmunp])?", raw)
        if match:
            prefixes = {"k":1e3,"M":1e6,"m":1e-3,"u":1e-6,"n":1e-9,"p":1e-12}
            scale = prefixes.get(match.group(2), 1)
            value = float(match.group(1)) * scale * ureg(unit)
        else:
            value = ureg(raw)
        return float(value.to(unit).magnitude)
    except Exception as exc:
        raise CircuitError("invalid_quantity", f"Could not read {text!r} as {unit}") from exc

def source_value(component, mode):
    source = component.get("source") or {}
    if mode == "dc":
        return quantity(source.get("magnitude", "0 V" if component["type"] == "voltage_source" else "0 A"), "V" if component["type"] == "voltage_source" else "A") if source.get("kind") == "dc" else 0.0
    if source.get("kind") != "ac": return 0j
    magnitude = quantity(source.get("magnitude"), "V" if component["type"] == "voltage_source" else "A")
    phase = quantity(source.get("phase", "0 deg"), "degree")
    return cmath.rect(magnitude, math.radians(phase))

supported = {"resistor", "capacitor", "inductor", "voltage_source", "current_source"}
unsupported = [c["id"] for c in circuit["components"] if c["type"] not in supported]
if unsupported:
    raise CircuitError("unsupported_component_for_analysis", "This analysis supports only linear RLC circuits and independent voltage/current sources.", unsupported)
if not any("0" in c["nodes"] for c in circuit["components"]):
    raise CircuitError("missing_ground", "The circuit needs a node named 0 as its reference ground.")

nodes = sorted({n for c in circuit["components"] for n in c["nodes"] if n != "0"})
node_index = {node:i for i,node in enumerate(nodes)}
voltage_branches = [c for c in circuit["components"] if c["type"] == "voltage_source"]
inductors = [c for c in circuit["components"] if c["type"] == "inductor"]

def add_rhs(vector, node, value):
    if node != "0": vector[node_index[node]] += value

def stamp_admittance(matrix, a, b, y):
    if a != "0": matrix[node_index[a], node_index[a]] += y
    if b != "0": matrix[node_index[b], node_index[b]] += y
    if a != "0" and b != "0":
        matrix[node_index[a], node_index[b]] -= y
        matrix[node_index[b], node_index[a]] -= y

def solve_numeric(mode, frequency=None, deactivate=False, test_current=None):
    ideal_branches = voltage_branches + (inductors if mode == "dc" else [])
    size = len(nodes) + len(ideal_branches)
    matrix = np.zeros((size, size), dtype=complex)
    rhs = np.zeros(size, dtype=complex)
    omega = 2 * math.pi * frequency if frequency else 0.0
    for component in circuit["components"]:
        kind, a, b = component["type"], component["nodes"][0], component["nodes"][1]
        if kind == "resistor":
            stamp_admittance(matrix, a, b, 1 / quantity(component["value"], "ohm"))
        elif kind == "capacitor" and mode == "ac":
            stamp_admittance(matrix, a, b, 1j * omega * quantity(component["value"], "farad"))
        elif kind == "inductor":
            if mode == "ac":
                stamp_admittance(matrix, a, b, 1 / (1j * omega * quantity(component["value"], "henry")))
            else:
                branch = len(nodes) + ideal_branches.index(component)
                if a != "0": matrix[node_index[a], branch] += 1; matrix[branch, node_index[a]] += 1
                if b != "0": matrix[node_index[b], branch] -= 1; matrix[branch, node_index[b]] -= 1
        elif kind == "current_source" and not deactivate:
            current = source_value(component, mode)
            add_rhs(rhs, a, -current); add_rhs(rhs, b, current)
        elif kind == "voltage_source":
            branch = len(nodes) + voltage_branches.index(component)
            if a != "0": matrix[node_index[a], branch] += 1; matrix[branch, node_index[a]] += 1
            if b != "0": matrix[node_index[b], branch] -= 1; matrix[branch, node_index[b]] -= 1
            rhs[branch] = 0 if deactivate else source_value(component, mode)
    if test_current:
        positive, negative, current = test_current
        add_rhs(rhs, positive, current); add_rhs(rhs, negative, -current)
    try:
        condition = np.linalg.cond(matrix)
        if not np.isfinite(condition) or condition > 1e15:
            raise CircuitError("singular_matrix", "The circuit matrix is singular or ill-conditioned. Check for floating nodes or conflicting ideal sources.")
        return np.linalg.solve(matrix, rhs)
    except np.linalg.LinAlgError as exc:
        raise CircuitError("singular_matrix", "The circuit cannot be solved. Check for floating nodes or conflicting ideal sources.") from exc

def complex_record(value, unit):
    value = complex(value)
    return {"real":value.real,"imaginary":value.imag,"magnitude":abs(value),"phaseDeg":math.degrees(cmath.phase(value)),"unit":unit}

def node_voltage(solution, node):
    return 0j if node == "0" else solution[node_index[node]]

def port_by_id(port_id):
    port = next((p for p in circuit.get("ports", []) if p["id"] == port_id), None)
    if not port: raise CircuitError("unknown_port", f"No port named {port_id!r} exists.", [port_id])
    return port

def result_at(mode, frequency=None):
    solution = solve_numeric(mode, frequency)
    ideal_branches = voltage_branches + (inductors if mode == "dc" else [])
    node_values = {node:complex_record(node_voltage(solution,node), "V") for node in nodes}
    branches = {}
    for component in circuit["components"]:
        a,b = component["nodes"][0], component["nodes"][1]
        voltage = node_voltage(solution,a) - node_voltage(solution,b)
        kind = component["type"]
        if kind == "resistor": current = voltage / quantity(component["value"], "ohm")
        elif kind == "capacitor": current = (1j*2*math.pi*frequency*quantity(component["value"], "farad")*voltage) if mode == "ac" else 0j
        elif kind == "inductor": current = voltage/(1j*2*math.pi*frequency*quantity(component["value"], "henry")) if mode == "ac" else solution[len(nodes)+ideal_branches.index(component)]
        elif kind == "voltage_source": current = solution[len(nodes)+ideal_branches.index(component)]
        else: current = source_value(component, mode)
        branches[component["id"]] = {"voltage":complex_record(voltage,"V"),"current":complex_record(current,"A"),"power":complex_record(voltage*np.conjugate(current),"VA")}
    return solution, {"nodes":node_values,"branches":branches}

def symbolic_transfer():
    source_id, output_id = analysis["inputSource"], analysis["outputPort"]
    if not any(c["id"] == source_id and c["type"] == "voltage_source" for c in circuit["components"]):
        raise CircuitError("unknown_source", "Transfer-function input must name an independent voltage source.", [source_id])
    port = port_by_id(output_id)
    s = sp.symbols("s")
    size = len(nodes) + len(voltage_branches)
    matrix = sp.zeros(size); rhs = sp.zeros(size,1)
    def sy(node): return node_index[node]
    def stamp(a,b,y):
        if a != "0": matrix[sy(a),sy(a)] += y
        if b != "0": matrix[sy(b),sy(b)] += y
        if a != "0" and b != "0": matrix[sy(a),sy(b)] -= y; matrix[sy(b),sy(a)] -= y
    for component in circuit["components"]:
        kind,a,b = component["type"],component["nodes"][0],component["nodes"][1]
        if kind == "resistor": stamp(a,b,sp.Float(1/quantity(component["value"],"ohm")))
        elif kind == "capacitor": stamp(a,b,s*sp.Float(quantity(component["value"],"farad")))
        elif kind == "inductor": stamp(a,b,1/(s*sp.Float(quantity(component["value"],"henry"))))
        elif kind == "voltage_source":
            branch = len(nodes)+voltage_branches.index(component)
            if a != "0": matrix[sy(a),branch]+=1; matrix[branch,sy(a)]+=1
            if b != "0": matrix[sy(b),branch]-=1; matrix[branch,sy(b)]-=1
            rhs[branch] = 1 if component["id"] == source_id else 0
    try: solution = matrix.inv() * rhs
    except Exception as exc: raise CircuitError("singular_matrix", "The symbolic circuit matrix is singular.") from exc
    expression = sp.cancel((0 if port["positive"]=="0" else solution[sy(port["positive"])]) - (0 if port["negative"]=="0" else solution[sy(port["negative"])]))
    if sp.count_ops(expression) > 300: raise CircuitError("symbolic_limit_exceeded", "The transfer function exceeds the symbolic complexity limit.")
    numerator, denominator = sp.fraction(expression)
    zeros = [complex(v) for v in sp.nroots(numerator)] if sp.degree(numerator,s) > 0 else []
    poles = [complex(v) for v in sp.nroots(denominator)] if sp.degree(denominator,s) > 0 else []
    return {"expression":str(expression),"latex":sp.latex(expression),"poles":[complex_record(v,"rad/s") for v in poles],"zeros":[complex_record(v,"rad/s") for v in zeros]}

def run():
    kind = analysis["type"]
    if kind == "dc_operating_point":
        _, values = result_at("dc")
        return {"success":True,"kind":"circuit_analysis","analysisType":kind,**values}
    if kind == "ac_point":
        frequency = quantity(analysis["frequency"], "Hz")
        if frequency <= 0: raise CircuitError("invalid_frequency", "AC analysis requires a positive frequency.")
        _, values = result_at("ac",frequency)
        return {"success":True,"kind":"circuit_analysis","analysisType":kind,"frequencyHz":frequency,**values}
    if kind == "ac_sweep":
        start, stop = quantity(analysis["start"],"Hz"), quantity(analysis["stop"],"Hz")
        if start <= 0 or stop <= start: raise CircuitError("invalid_sweep", "AC sweep requires 0 < start < stop.")
        port = port_by_id(analysis["outputPort"]) if analysis.get("outputPort") else (circuit.get("ports") or [{"positive":nodes[-1],"negative":"0","id":"output"}])[0]
        traces=[]
        for frequency in np.geomspace(start,stop,analysis.get("points",160)):
            solution=solve_numeric("ac",float(frequency)); value=node_voltage(solution,port["positive"])-node_voltage(solution,port["negative"])
            traces.append({"frequencyHz":float(frequency),"magnitudeDb":20*math.log10(max(abs(value),1e-300)),"phaseDeg":math.degrees(cmath.phase(value))})
        return {"success":True,"kind":"circuit_analysis","analysisType":kind,"port":port["id"],"plot":{"type":"bode","title":circuit["title"]+" frequency response","traces":traces}}
    if kind == "transfer_function":
        return {"success":True,"kind":"circuit_analysis","analysisType":kind,"transferFunction":symbolic_transfer()}
    if kind == "equivalent":
        port=port_by_id(analysis["port"]); original=solve_numeric("dc")
        vth=node_voltage(original,port["positive"])-node_voltage(original,port["negative"])
        test=solve_numeric("dc",deactivate=True,test_current=(port["positive"],port["negative"],1.0))
        resistance=(node_voltage(test,port["positive"])-node_voltage(test,port["negative"])).real
        if resistance <= 0: raise CircuitError("invalid_equivalent", "The equivalent resistance is not positive for this ideal-source network.")
        record={"port":port["id"],"resistance":{"value":resistance,"unit":"ohm"},"theveninVoltage":complex_record(vth,"V"),"nortonCurrent":complex_record(vth/resistance,"A")}
        return {"success":True,"kind":"circuit_analysis","analysisType":kind,"equivalentType":analysis["kind"],"equivalent":record}
    raise CircuitError("unsupported_analysis", f"Unsupported analysis {kind!r}.")

try:
    print(json.dumps(run(),separators=(",",":"),allow_nan=False))
except CircuitError as exc:
    print(json.dumps({"success":False,"kind":"circuit_analysis_error","code":exc.code,"error":str(exc),"affected":exc.affected},separators=(",",":")))
except Exception as exc:
    print(json.dumps({"success":False,"kind":"circuit_analysis_error","code":"solver_failed","error":str(exc)},separators=(",",":")))
`
}

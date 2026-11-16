import { expect, test } from "bun:test"
import { getBoundFromCenteredRect } from "@tscircuit/math-utils"
import { getTestFixture } from "tests/fixtures/get-test-fixture"

test("schematic auto-layout places nested groups sharing a sheet under separate PCB groups without overlap", async () => {
  const { circuit } = getTestFixture()

  circuit.add(
    <board width={25} height={15} routingDisabled schAutoLayoutEnabled>
      <schematicsheet name="main" sheetIndex={1} />
      <schematicsheet name="aux" sheetIndex={2} />
      <group name="Left" pcbX={-6} schAutoLayoutEnabled>
        <group name="A" schSheetName="main" schAutoLayoutEnabled>
          <resistor
            name="R1"
            resistance="1k"
            footprint="0603"
            schSheetName="main"
          />
        </group>
        <group name="A_Aux" schSheetName="aux" schAutoLayoutEnabled>
          <resistor
            name="R3"
            resistance="4.7k"
            footprint="0603"
            schSheetName="aux"
          />
        </group>
      </group>
      <group name="Right" pcbX={6} schAutoLayoutEnabled>
        <group name="B" schSheetName="main" schAutoLayoutEnabled>
          <resistor
            name="R2"
            resistance="2.2k"
            footprint="0603"
            schSheetName="main"
          />
        </group>
      </group>
    </board>,
  )

  await circuit.renderUntilSettled()

  const mainSheet = circuit.db.schematic_sheet.getWhere({ name: "main" })!
  const auxSheet = circuit.db.schematic_sheet.getWhere({ name: "aux" })!

  const r1Source = circuit.db.source_component.getWhere({ name: "R1" })!
  const r2Source = circuit.db.source_component.getWhere({ name: "R2" })!
  const r3Source = circuit.db.source_component.getWhere({ name: "R3" })!

  const r1Sch = circuit.db.schematic_component.getWhere({
    source_component_id: r1Source.source_component_id,
  })!
  const r2Sch = circuit.db.schematic_component.getWhere({
    source_component_id: r2Source.source_component_id,
  })!
  const r3Sch = circuit.db.schematic_component.getWhere({
    source_component_id: r3Source.source_component_id,
  })!

  expect(r1Sch.schematic_sheet_id).toBe(mainSheet.schematic_sheet_id)
  expect(r2Sch.schematic_sheet_id).toBe(mainSheet.schematic_sheet_id)
  expect(r3Sch.schematic_sheet_id).toBe(auxSheet.schematic_sheet_id)

  const distance = Math.hypot(
    r1Sch.center.x - r2Sch.center.x,
    r1Sch.center.y - r2Sch.center.y,
  )
  expect(distance).toBeGreaterThan(1)

  const r1Bounds = getBoundFromCenteredRect({
    center: r1Sch.center,
    width: r1Sch.size.width,
    height: r1Sch.size.height,
  })
  const r2Bounds = getBoundFromCenteredRect({
    center: r2Sch.center,
    width: r2Sch.size.width,
    height: r2Sch.size.height,
  })
  const overlapsOnMainSheet =
    r1Bounds.minX < r2Bounds.maxX &&
    r1Bounds.maxX > r2Bounds.minX &&
    r1Bounds.minY < r2Bounds.maxY &&
    r1Bounds.maxY > r2Bounds.minY
  expect(overlapsOnMainSheet).toBe(false)

  // Verify PCB group placement and hierarchy are preserved
  const r1Pcb = circuit.db.pcb_component.getWhere({
    source_component_id: r1Source.source_component_id,
  })!
  const r2Pcb = circuit.db.pcb_component.getWhere({
    source_component_id: r2Source.source_component_id,
  })!
  expect(r1Pcb.center.x).toBeLessThan(-3)
  expect(r2Pcb.center.x).toBeGreaterThan(3)

  await expect(circuit).toMatchStackedSchematicSnapshot(import.meta.path)
  await expect(circuit).toMatchPcbSnapshot(import.meta.path)
})

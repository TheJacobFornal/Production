import adsk.core
import adsk.fusion
import adsk.cam
import traceback
import os
import csv

try:
    from openpyxl import Workbook
except Exception:  # openpyxl might not be available in Fusion environment
    Workbook = None

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)

        ui.messageBox("Extracting component info...")

        # Collect component information for export
        component_rows = []

        for comp in design.allComponents:
            ui.messageBox(f'Component: {comp.name}')

            # Get Dimensions
            boundingBox = comp.boundingBox
            length = boundingBox.maxPoint.x - boundingBox.minPoint.x
            width  = boundingBox.maxPoint.y - boundingBox.minPoint.y
            height = boundingBox.maxPoint.z - boundingBox.minPoint.z

            ui.messageBox(
                f'Dimensions (cm):\nLength: {length*10:.2f}, '
                f'Width: {width*10:.2f}, Height: {height*10:.2f}')

            # Get Material
            material = comp.material.name if comp.material else "No material assigned"
            ui.messageBox(f'Material: {material}')

            component_rows.append([
                comp.name,
                round(length * 10, 2),
                round(width * 10, 2),
                round(height * 10, 2),
                material,
            ])

        # Save collected data to Excel (or CSV if openpyxl is unavailable)
        output_file = os.path.join(os.path.dirname(__file__), 'component_data')
        if Workbook:
            wb = Workbook()
            ws = wb.active
            ws.append(['Name', 'Length(cm)', 'Width(cm)', 'Height(cm)', 'Material'])
            for row in component_rows:
                ws.append(row)
            file_path = output_file + '.xlsx'
            wb.save(file_path)
        else:
            file_path = output_file + '.csv'
            with open(file_path, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(['Name', 'Length(cm)', 'Width(cm)', 'Height(cm)', 'Material'])
                writer.writerows(component_rows)

        ui.messageBox(f'Component data written to: {file_path}')

        # --- Get CAM Estimated Times ---
        # Access the CAM product from the active document. This works even if
        # the Design workspace is active because `activeProduct` will then be a
        # `Design` instance. Using `itemByProductType` ensures we can obtain the
        # CAM product regardless of the currently active workspace.
        # Try to obtain the CAM product if it exists. ``itemByProductType``
        # raises a ``RuntimeError`` when the product isn't present, so use a
        # ``try/except`` block to handle documents without manufacturing data.
        cam_product = None
        try:
            cam_product = adsk.cam.CAM.cast(
                app.activeDocument.products.itemByProductType(
                    adsk.cam.CAM.classType()))
        except:  # noqa: E722 - Fusion API throws generic RuntimeError
            cam_product = None

        if not cam_product:
            ui.messageBox("No CAM product found.")
            return

        if cam_product.setups.count == 0:
            ui.messageBox("No manufacturing setups found.")
            return

        for setup in cam_product.setups:
            ui.messageBox(f'Setup: {setup.name}\nEstimated Total Time: {setup.estimatedMachiningTime:.2f} sec')

            for operation in setup.operations:
                name = operation.name
                est_time = operation.estimatedMachiningTime
                ui.messageBox(f' - Operation: {name}\n   Time: {est_time:.2f} sec')

    except Exception as e:
        if ui:
            ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))

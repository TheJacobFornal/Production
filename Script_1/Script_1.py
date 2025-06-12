import adsk.core, adsk.fusion, adsk.cam, traceback

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)

        ui.messageBox("Extracting component info...")

        for comp in design.allComponents:
            ui.messageBox(f'Component: {comp.name}')

            # Get Dimensions
            boundingBox = comp.boundingBox
            length = boundingBox.maxPoint.x - boundingBox.minPoint.x
            width  = boundingBox.maxPoint.y - boundingBox.minPoint.y
            height = boundingBox.maxPoint.z - boundingBox.minPoint.z

            ui.messageBox(f'Dimensions (cm):\nLength: {length*10:.2f}, Width: {width*10:.2f}, Height: {height*10:.2f}')

            # Get Material
            material = comp.material.name if comp.material else "No material assigned"
            ui.messageBox(f'Material: {material}')

        # --- Get CAM Estimated Times ---
        # Access the CAM product from the active document. This works even if
        # the Design workspace is active because `activeProduct` will then be a
        # `Design` instance. Using `itemByProductType` ensures we can obtain the
        # CAM product regardless of the currently active workspace.
        cam_product = app.activeDocument.products.itemByProductType(
            adsk.cam.CAM.classType())
        cam_product = adsk.cam.CAM.cast(cam_product)

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

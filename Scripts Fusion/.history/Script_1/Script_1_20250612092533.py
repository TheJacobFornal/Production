import adsk.core, adsk.fusion, traceback

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui  = app.userInterface
        design = app.activeProduct

        # 1. Get Root Component
        rootComp = design.rootComponent

        # 2. Loop through all components
        for comp in rootComp.allComponents:
            ui.messageBox(f'Component: {comp.name}')

            # --- Get Dimensions ---
            boundingBox = comp.boundingBox
            length = boundingBox.maxPoint.x - boundingBox.minPoint.x
            width  = boundingBox.maxPoint.y - boundingBox.minPoint.y
            height = boundingBox.maxPoint.z - boundingBox.minPoint.z

            ui.messageBox(f'Dimensions (cm):\nLength: {length*10:.2f}, Width: {width*10:.2f}, Height: {height*10:.2f}')

            # --- Get Material ---
            material = comp.material.name if comp.material else "No material assigned"
            ui.messageBox(f'Material: {material}')

        # 3. (Optional) Estimated CAM Time (requires a setup)
        cam = app.activeProduct
        if hasattr(cam, 'setups') and cam.setups.count > 0:
            for setup in cam.setups:
                time = setup.estimatedMachiningTime
                ui.messageBox(f'Estimated Machining Time for {setup.name}: {time:.2f} seconds')

    except Exception as e:
        if ui:
            ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))
